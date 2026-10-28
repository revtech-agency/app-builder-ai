// Server functions for the supplier invoice screens, backed by the HubSpot "Procure-to-pay"
// pipeline and the n8n invoice-intake / invoice-assistant webhooks. Types live in
// src/lib/invoice-types.ts (the contract); pure mapping helpers in src/lib/invoice-mapping.ts.
// Set INVOICE_DATA_SOURCE=mock to run everything on src/lib/invoice-fixtures.ts instead.
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin } from "@/lib/admin";
import { FIXTURE_INVOICES, FIXTURE_SUPPLIERS } from "@/lib/invoice-fixtures";
import {
  computeOverview,
  decisionPermission,
  isDemoEmail,
  latestAudit,
  OPEN_EXCLUDED_STAGES,
  num,
  toLineItem,
  toSummary,
} from "@/lib/invoice-mapping";
import type { HsObject } from "@/lib/invoice-mapping";
import { INVOICE_PIPELINE_ID, INVOICE_STAGE_IDS } from "@/lib/invoice-types";
import type {
  AnomalyFlag,
  IntakeResult,
  InvoiceDetail,
  InvoiceSummary,
  OverviewStats,
  SupplierInfo,
} from "@/lib/invoice-types";

const isMock = () => process.env["INVOICE_DATA_SOURCE"] === "mock";

type Caller = { userId: string; email: string };

function callerOf(context: { userId: string; claims: unknown }): Caller {
  return { userId: context.userId, email: (context.claims as { email?: string }).email ?? "" };
}

// Access rule: signed in AND (admin OR the demo reviewer account). Everyone else is refused.
// In mock mode any signed-in user is allowed.
async function checkStaff(caller: Caller): Promise<{ isAdmin: boolean; isDemo: boolean }> {
  if (isMock()) return { isAdmin: false, isDemo: true };
  const admin = await isAdmin(caller.userId);
  const demo = isDemoEmail(caller.email, process.env["DEMO_EMAIL"]);
  if (!admin && !demo) throw new Error("Only finance staff can use the invoice worker.");
  return { isAdmin: admin, isDemo: demo };
}

const requireInvoiceStaff = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    await checkStaff(callerOf(context));
    return next();
  });

const DEAL_PROPS = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "createdate",
  "document_type",
  "invoice_number",
  "invoice_date",
  "due_date",
  "po_number",
  "iban_on_invoice",
  "vat_amount",
  "match_result",
  "approval_level",
  "anomaly_flags",
  "exception_reason",
  "order_channel",
  "min_field_confidence",
  "approved_by",
  "raw_order_text",
];
const LINE_PROPS = [
  "hs_sku",
  "name",
  "quantity",
  "price",
  "po_line_ref",
  "line_check",
  "line_check_note",
  "field_confidence",
];
const COMPANY_PROPS = [
  "name",
  "supplier_status",
  "supplier_vat_id",
  "supplier_iban",
  "previous_iban",
  "iban_changed_on",
  "tax_certificate_valid_until",
];

const chunk = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const stripDetail = (d: InvoiceDetail): InvoiceSummary => {
  const {
    ibanOnInvoice: _a,
    vatAmount: _b,
    minFieldConfidence: _c,
    rawText: _d,
    lines: _e,
    audit: _f,
    approvedBy: _g,
    canDecide: _h,
    cannotDecideReason: _i,
    ...summary
  } = d;
  return summary;
};

function humanError(e: unknown, what: string): Error {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return new Error(`The ${what} took too long to answer. Please try again.`);
    }
    if (/N8N_APP_KEY/.test(e.message)) return new Error(`The ${what} isn't configured yet.`);
    if (/HUBSPOT_ACCESS_TOKEN/.test(e.message)) return new Error("HubSpot isn't configured yet.");
    return new Error(e.message.replace(/^The order assistant returned/, `The ${what} returned`));
  }
  return new Error(`The ${what} is unavailable right now.`);
}

// ---------------------------------------------------------------- HubSpot access

type HubspotFn = <T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown },
) => Promise<T>;
type AssocBatch = { results: { from: { id: string }; to: { toObjectId: number | string }[] }[] };

async function hs(): Promise<HubspotFn> {
  const { hubspot } = await import("@/lib/hubspot.server");
  return hubspot;
}

async function readAssoc(
  hubspot: HubspotFn,
  fromType: string,
  toType: string,
  ids: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const batches = await Promise.all(
    chunk(ids, 100).map((c) =>
      hubspot<AssocBatch>(`/crm/v4/associations/${fromType}/${toType}/batch/read`, {
        body: { inputs: c.map((id) => ({ id })) },
      }),
    ),
  );
  for (const r of batches.flatMap((b) => b.results)) {
    map.set(String(r.from.id), r.to.map((t) => String(t.toObjectId)));
  }
  return map;
}

async function readObjects(
  hubspot: HubspotFn,
  type: string,
  ids: string[],
  properties: string[],
): Promise<Map<string, HsObject>> {
  const batches = await Promise.all(
    chunk([...new Set(ids)], 100).map((c) =>
      hubspot<{ results: HsObject[] }>(`/crm/v3/objects/${type}/batch/read`, {
        body: { properties, inputs: c.map((id) => ({ id })) },
      }),
    ),
  );
  return new Map(batches.flatMap((b) => b.results).map((o) => [o.id, o]));
}

async function suppliersFor(
  hubspot: HubspotFn,
  deals: HsObject[],
): Promise<Map<string, { id: string; name: string }>> {
  const out = new Map<string, { id: string; name: string }>();
  if (deals.length === 0) return out;
  const assoc = await readAssoc(hubspot, "deals", "companies", deals.map((d) => d.id));
  const companyIds = [...assoc.values()].map((v) => v[0]).filter((v): v is string => Boolean(v));
  const companies = await readObjects(hubspot, "companies", companyIds, ["name"]);
  for (const [dealId, ids] of assoc) {
    const c = ids[0] ? companies.get(ids[0]) : undefined;
    if (c) out.set(dealId, { id: c.id, name: c.properties["name"] || "Unnamed supplier" });
  }
  return out;
}

const INVOICE_DOC_TYPES = ["invoice", "credit_note", "reminder", "question"];

async function fetchInvoiceDeals(hubspot: HubspotFn): Promise<HsObject[]> {
  const deals: HsObject[] = [];
  let after: string | undefined;
  type Page = { results: HsObject[]; paging?: { next?: { after?: string } } };
  do {
    const page: Page = await hubspot<Page>("/crm/v3/objects/deals/search", {
      body: {
        filterGroups: [
          {
            filters: [
              { propertyName: "pipeline", operator: "EQ", value: INVOICE_PIPELINE_ID },
              { propertyName: "document_type", operator: "IN", values: INVOICE_DOC_TYPES },
            ],
          },
        ],
        properties: DEAL_PROPS,
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        limit: 100,
        ...(after ? { after } : {}),
      },
    });
    deals.push(...page.results);
    after = page.paging?.next?.after;
  } while (after && deals.length < 1000);
  return deals.slice(0, 1000);
}

async function loadSummaries(): Promise<InvoiceSummary[]> {
  if (isMock()) return FIXTURE_INVOICES.map(stripDetail);
  try {
    const hubspot = await hs();
    const deals = await fetchInvoiceDeals(hubspot);
    const suppliers = await suppliersFor(hubspot, deals);
    return deals.map((d) => toSummary(d, suppliers.get(d.id) ?? null));
  } catch (e) {
    throw humanError(e, "invoice data");
  }
}

// ---------------------------------------------------------------- server functions

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireInvoiceStaff])
  .handler(async (): Promise<InvoiceSummary[]> => loadSummaries());

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireInvoiceStaff])
  .inputValidator((input: { invoiceId: string }) =>
    z.object({ invoiceId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<InvoiceDetail> => {
    const who = await checkStaff(callerOf(context));
    if (isMock()) {
      const found = FIXTURE_INVOICES.find((i) => i.id === data.invoiceId);
      if (!found) throw new Error("Invoice not found.");
      return {
        ...found,
        ...decisionPermission({ stage: found.stage, approvalLevel: found.approvalLevel, documentType: found.documentType, ...who }),
      };
    }
    try {
      const hubspot = await hs();
      if (!/^\d+$/.test(data.invoiceId)) throw new Error("Invoice not found.");
      const deal = await hubspot<HsObject>(
        `/crm/v3/objects/deals/${data.invoiceId}?properties=${DEAL_PROPS.join(",")}`,
      ).catch((e: unknown) => {
        if (e instanceof Error && /\(404\)/.test(e.message)) throw new Error("Invoice not found.");
        throw e;
      });
      if (deal.properties["pipeline"] !== INVOICE_PIPELINE_ID) throw new Error("Invoice not found.");

      const [suppliers, lineAssoc, noteAssoc] = await Promise.all([
        suppliersFor(hubspot, [deal]),
        readAssoc(hubspot, "deals", "line_items", [deal.id]),
        readAssoc(hubspot, "deals", "notes", [deal.id]),
      ]);
      const [lineObjs, noteObjs] = await Promise.all([
        readObjects(hubspot, "line_items", lineAssoc.get(deal.id) ?? [], LINE_PROPS),
        readObjects(hubspot, "notes", noteAssoc.get(deal.id) ?? [], [
          "hs_note_body",
          "hs_timestamp",
          "hs_createdate",
        ]),
      ]);

      const summary = toSummary(deal, suppliers.get(deal.id) ?? null);
      const p = deal.properties;
      return {
        ...summary,
        ibanOnInvoice: p["iban_on_invoice"] || null,
        vatAmount: num(p["vat_amount"]),
        minFieldConfidence: num(p["min_field_confidence"]),
        rawText: p["raw_order_text"] || null,
        lines: (lineAssoc.get(deal.id) ?? [])
          .map((id) => lineObjs.get(id))
          .filter((l): l is HsObject => Boolean(l))
          .map(toLineItem),
        audit: latestAudit([...noteObjs.values()]),
        approvedBy: p["approved_by"] || null,
        ...decisionPermission({ stage: summary.stage, approvalLevel: summary.approvalLevel, documentType: summary.documentType, ...who }),
      };
    } catch (e) {
      throw humanError(e, "invoice data");
    }
  });

export const decideInvoice = createServerFn({ method: "POST" })
  .middleware([requireInvoiceStaff])
  .inputValidator((input: { invoiceId: string; decision: "approve" | "reject" }) =>
    z.object({ invoiceId: z.string().min(1), decision: z.enum(["approve", "reject"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<InvoiceSummary> => {
    const caller = callerOf(context);
    const who = await checkStaff(caller);
    const approve = data.decision === "approve";

    if (isMock()) {
      const found = FIXTURE_INVOICES.find((i) => i.id === data.invoiceId);
      if (!found) throw new Error("Invoice not found.");
      const perm = decisionPermission({ stage: found.stage, approvalLevel: found.approvalLevel, documentType: found.documentType, ...who });
      if (!perm.canDecide) throw new Error(perm.cannotDecideReason ?? "You can't decide this invoice.");
      const stage = approve ? "approved" : "rejected";
      found.stage = stage;
      found.stageLabel = approve ? "Approved for payment" : "Rejected";
      found.approvedBy = approve ? caller.email || "demo" : found.approvedBy;
      found.canDecide = false;
      found.cannotDecideReason = approve ? "Already approved." : "Already rejected.";
      return stripDetail(found);
    }

    try {
      const hubspot = await hs();
      if (!/^\d+$/.test(data.invoiceId)) throw new Error("Invoice not found.");
      const deal = await hubspot<HsObject>(
        `/crm/v3/objects/deals/${data.invoiceId}?properties=${DEAL_PROPS.join(",")}`,
      );
      if (deal.properties["pipeline"] !== INVOICE_PIPELINE_ID) throw new Error("Invoice not found.");
      const current = toSummary(deal, null);
      const perm = decisionPermission({ stage: current.stage, approvalLevel: current.approvalLevel, documentType: current.documentType, ...who });
      if (!perm.canDecide) throw new Error(perm.cannotDecideReason ?? "You can't decide this invoice.");

      const stageId = INVOICE_STAGE_IDS[approve ? "approved" : "rejected"];
      const updated = await hubspot<HsObject>(`/crm/v3/objects/deals/${deal.id}`, {
        method: "PATCH",
        body: {
          properties: {
            dealstage: stageId,
            ...(approve ? { approved_by: caller.email } : {}),
          },
        },
      });

      const today = new Date().toISOString().slice(0, 10);
      try {
        await hubspot("/crm/v3/objects/notes", {
          body: {
            properties: {
              hs_timestamp: new Date().toISOString(),
              hs_note_body: `<p>${approve ? "Approved" : "Rejected"} by ${caller.email
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")} on ${today}</p>`,
            },
            associations: [
              {
                to: { id: deal.id },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
              },
            ],
          },
        });
      } catch {
        // The decision itself is saved; a missing note must not fail the request.
      }

      const suppliers = await suppliersFor(hubspot, [deal]);
      return toSummary(
        { id: deal.id, properties: { ...deal.properties, ...updated.properties, dealstage: stageId } },
        suppliers.get(deal.id) ?? null,
      );
    } catch (e) {
      throw humanError(e, "invoice data");
    }
  });

type RawIntake = Partial<Omit<IntakeResult, "anomaly_flags" | "lines">> & {
  anomaly_flags?: unknown;
  lines?: unknown;
};

function normaliseIntake(r: RawIntake): IntakeResult {
  const flags = Array.isArray(r.anomaly_flags)
    ? (r.anomaly_flags as AnomalyFlag[])
    : typeof r.anomaly_flags === "string"
      ? (r.anomaly_flags.split(";").map((s) => s.trim()).filter(Boolean) as AnomalyFlag[])
      : [];
  return {
    deal_id: r.deal_id ?? null,
    stage: r.stage ?? "received",
    stage_label: r.stage_label ?? "Received",
    document_type: r.document_type ?? "invoice",
    supplier_name: r.supplier_name ?? "",
    invoice_number: r.invoice_number ?? "",
    amount: Number(r.amount) || 0,
    match_result: r.match_result ?? null,
    approval_level: r.approval_level ?? null,
    anomaly_flags: flags,
    exception_reason: r.exception_reason ?? "",
    lines: Array.isArray(r.lines) ? (r.lines as IntakeResult["lines"]) : [],
    ...(r.supplier_email_draft ? { supplier_email_draft: r.supplier_email_draft } : {}),
    ...(r.already_processed ? { already_processed: true } : {}),
  };
}

export const submitInvoice = createServerFn({ method: "POST" })
  .middleware([requireInvoiceStaff])
  .inputValidator((input: { text?: string; pdfBase64?: string; filename?: string }) =>
    z
      .object({
        text: z.string().max(60_000).optional(),
        pdfBase64: z.string().max(15_000_000).optional(),
        filename: z.string().max(200).optional(),
      })
      .refine((v) => Boolean(v.text?.trim() || v.pdfBase64), "Paste the invoice text or upload a PDF.")
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<IntakeResult> => {
    const caller = callerOf(context);
    if (isMock()) {
      return {
        deal_id: "mock-3",
        stage: "needs_review",
        stage_label: "Needs review",
        document_type: "invoice",
        supplier_name: "TechNova Hardware SRL (demo)",
        invoice_number: "TN-55230",
        amount: 4815.8,
        match_result: "mismatch",
        approval_level: "team_lead",
        anomaly_flags: [],
        exception_reason:
          "Docking stations invoiced at €199.00, PO price €185.00 (+7.6%, over the 2% tolerance).",
        lines: [
          {
            name: "USB-C docking station",
            quantity: 20,
            price: 199,
            line_check: "price_off",
            line_check_note: "Invoiced 20 at EUR 199.00; PO price EUR 185.00 (+7.6%).",
          },
        ],
      };
    }
    try {
      const { n8n } = await import("@/lib/hubspot.server");
      const { randomUUID } = await import("node:crypto");
      const res = await n8n<RawIntake>(
        "invoice-intake",
        {
          source_id: `app-${randomUUID()}`,
          ...(data.filename ? { filename: data.filename } : {}),
          ...(data.pdfBase64 ? { pdf_base64: data.pdfBase64 } : {}),
          ...(data.text ? { text: data.text } : {}),
          submitted_by: caller.email,
        },
        120_000,
      );
      return normaliseIntake(res);
    } catch (e) {
      throw humanError(e, "invoice worker");
    }
  });

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireInvoiceStaff])
  .inputValidator((input: { sessionId: string; message: string; invoiceId?: string }) =>
    z
      .object({
        sessionId: z.string().min(1).max(100),
        message: z.string().trim().min(1).max(4000),
        invoiceId: z
          .string()
          .regex(/^[A-Za-z0-9-]{1,40}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ reply: string }> => {
    if (isMock()) {
      const inv = FIXTURE_INVOICES.find((i) => i.id === data.invoiceId);
      if (!inv) {
        return {
          reply: `There are ${FIXTURE_INVOICES.length} invoices in the demo data. Open one and ask me why it was held back.`,
        };
      }
      const why =
        inv.exceptionReason ??
        (inv.anomalyFlags.length ? inv.anomalyFlags.join(", ") : "All checks passed, nothing unusual found.");
      return { reply: `Invoice ${inv.ref} from ${inv.supplierName} is "${inv.stageLabel}". ${why}` };
    }
    try {
      const { n8n } = await import("@/lib/hubspot.server");
      const res = await n8n<{ reply?: string }>("invoice-assistant", {
        session_id: `${context.userId}:${data.sessionId}`,
        message: data.message,
        ...(data.invoiceId ? { invoice_deal_id: data.invoiceId } : {}),
      });
      return { reply: res.reply ?? "" };
    } catch (e) {
      throw humanError(e, "invoice assistant");
    }
  });

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireInvoiceStaff])
  .handler(async (): Promise<SupplierInfo[]> => {
    const open = new Map<string, number>();
    const invoices = await loadSummaries();
    for (const i of invoices) {
      if (i.supplierId && !OPEN_EXCLUDED_STAGES.includes(i.stage)) {
        open.set(i.supplierId, (open.get(i.supplierId) ?? 0) + 1);
      }
    }
    if (isMock()) {
      return FIXTURE_SUPPLIERS.map((s) => ({ ...s, openInvoices: open.get(s.id) ?? 0 }));
    }
    try {
      const hubspot = await hs();
      const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
        body: {
          filterGroups: [{ filters: [{ propertyName: "supplier_status", operator: "HAS_PROPERTY" }] }],
          properties: COMPANY_PROPS,
          sorts: [{ propertyName: "name", direction: "ASCENDING" }],
          limit: 100,
        },
      });
      const today = new Date().toISOString().slice(0, 10);
      return res.results.map((c): SupplierInfo => {
        const p = c.properties;
        const until = (p["tax_certificate_valid_until"] ?? "").slice(0, 10) || null;
        return {
          id: c.id,
          name: p["name"] || "Unnamed supplier",
          status: p["supplier_status"] || "pending_onboarding",
          vatId: p["supplier_vat_id"] || null,
          iban: p["supplier_iban"] || null,
          previousIban: p["previous_iban"] || null,
          ibanChangedOn: (p["iban_changed_on"] ?? "").slice(0, 10) || null,
          taxCertificateValidUntil: until,
          certificateExpired: !until || until < today,
          openInvoices: open.get(c.id) ?? 0,
        };
      });
    } catch (e) {
      throw humanError(e, "supplier list");
    }
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireInvoiceStaff])
  .handler(async (): Promise<OverviewStats> => computeOverview(await loadSummaries()));

