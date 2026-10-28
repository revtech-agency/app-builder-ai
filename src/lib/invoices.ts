// Invoice desk for the accounts-payable team, backed by HubSpot (portal 149650024) and the
// n8n invoice worker. Every function requires an ap_reviewer or admin; tokens stay server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireInvoiceDesk } from "@/lib/admin";
import {
  INVOICE_STAGES,
  P2P_PIPELINE_ID,
  PO_DOCUMENT_TYPE,
  PO_STAGES,
  splitList,
  stageIdFor,
} from "@/lib/invoice-rules";

type Props = Record<string, string | null | undefined>;
type HsObject = { id: string; properties: Props };
type AssocBatch = { results: { from: { id: string }; to: { toObjectId: number | string }[] }[] };

export type InvoiceSummary = {
  id: string;
  name: string;
  stageId: string;
  stage: string;
  stageLabel: string;
  amount: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  poNumber: string | null;
  documentType: string | null;
  matchResult: string | null;
  approvalLevel: string | null;
  anomalyFlags: string[];
  exceptionReason: string | null;
  channel: string | null;
  createdAt: string | null;
  supplierName: string | null;
};

export type InvoiceLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  amount: number;
  poLineRef: string | null;
  lineCheck: string[];
  lineCheckNote: string | null;
};

export type PoLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  receivedQuantity: number;
  deliveryNoteRef: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  status: string | null;
  vatId: string | null;
  iban: string | null;
  previousIban: string | null;
  ibanChangedOn: string | null;
  certificateValidUntil: string | null;
};

export type InvoiceNote = { id: string; body: string; timestamp: string | null };

export type PurchaseOrder = {
  id: string;
  poNumber: string | null;
  budgetCode: string | null;
  requester: string | null;
  amount: number;
  stage: string;
  stageLabel: string;
  supplierName: string | null;
  lines: PoLine[];
};

export type InvoiceDetail = InvoiceSummary & {
  ibanOnInvoice: string | null;
  vatAmount: number | null;
  rawText: string | null;
  approvedBy: string | null;
  lines: InvoiceLine[];
  notes: InvoiceNote[];
  supplier: Supplier | null;
  po: PurchaseOrder | null;
};

export type SupplierRow = Supplier & { openInvoices: number };

export type SubmitResult = {
  deal_id?: string;
  stage?: string;
  stage_label?: string;
  document_type?: string;
  supplier_name?: string;
  invoice_number?: string;
  amount?: number;
  match_result?: string;
  approval_level?: string;
  anomaly_flags?: string[] | string;
  exception_reason?: string;
  lines?: { name?: string; sku?: string; quantity?: number; price?: number; line_check?: string; line_check_note?: string }[];
  supplier_email_draft?: string;
};

const num = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

const chunk = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const INVOICE_PROPS = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "invoice_number",
  "invoice_date",
  "due_date",
  "po_number",
  "document_type",
  "match_result",
  "approval_level",
  "anomaly_flags",
  "exception_reason",
  "order_channel",
  "createdate",
];
const DETAIL_PROPS = [...INVOICE_PROPS, "iban_on_invoice", "vat_amount", "raw_order_text", "approved_by"];
const SUPPLIER_PROPS = [
  "name",
  "supplier_status",
  "supplier_vat_id",
  "supplier_iban",
  "previous_iban",
  "iban_changed_on",
  "tax_certificate_valid_until",
];
const PO_PROPS = ["dealname", "dealstage", "pipeline", "amount", "po_number", "budget_code", "po_requester", "document_type"];
const PO_LINE_PROPS = ["name", "hs_sku", "quantity", "price", "received_quantity", "delivery_note_ref"];

const OPEN_KEYS = new Set(["received", "waiting_on_supplier", "needs_review", "ready_to_approve"]);

async function hs() {
  return (await import("@/lib/hubspot.server")).hubspot;
}

async function readAssoc(fromType: string, toType: string, ids: string[]) {
  const hubspot = await hs();
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
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

async function readObjects(type: string, ids: string[], properties: string[]) {
  const hubspot = await hs();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, HsObject>();
  const batches = await Promise.all(
    chunk(unique, 100).map((c) =>
      hubspot<{ results: HsObject[] }>(`/crm/v3/objects/${type}/batch/read`, {
        body: { properties, inputs: c.map((id) => ({ id })) },
      }),
    ),
  );
  return new Map(batches.flatMap((b) => b.results).map((o) => [o.id, o]));
}

async function searchDeals(isPo: boolean, properties: string[], extra: object[] = [], limit = 200) {
  const hubspot = await hs();
  const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/deals/search", {
    body: {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: P2P_PIPELINE_ID },
            { propertyName: "document_type", operator: isPo ? "EQ" : "NEQ", value: PO_DOCUMENT_TYPE },
            ...extra,
          ],
        },
      ],
      properties,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      limit,
    },
  });
  // Belt and braces: never let another pipeline or the wrong document type through.
  return res.results.filter(
    (d) =>
      d.properties["pipeline"] === P2P_PIPELINE_ID &&
      (d.properties["document_type"] === PO_DOCUMENT_TYPE) === isPo,
  );
}

async function supplierNames(dealIds: string[]) {
  const assoc = await readAssoc("deals", "companies", dealIds);
  const companies = await readObjects("companies", [...assoc.values()].flat(), ["name"]);
  const byDeal = new Map<string, string | null>();
  for (const id of dealIds) {
    const cid = assoc.get(id)?.[0];
    byDeal.set(id, (cid && companies.get(cid)?.properties["name"]) || null);
  }
  return { byDeal, assoc };
}

function toSummary(d: HsObject, supplierName: string | null): InvoiceSummary {
  const p = d.properties;
  const stageId = p["dealstage"] ?? "";
  const stage = INVOICE_STAGES[stageId];
  return {
    id: d.id,
    name: p["dealname"] ?? "",
    stageId,
    stage: stage?.key ?? "received",
    stageLabel: stage?.label ?? "Unknown",
    amount: num(p["amount"]) ?? 0,
    invoiceNumber: p["invoice_number"] || null,
    invoiceDate: p["invoice_date"] || null,
    dueDate: p["due_date"] || null,
    poNumber: p["po_number"] || null,
    documentType: p["document_type"] || null,
    matchResult: p["match_result"] || null,
    approvalLevel: p["approval_level"] || null,
    anomalyFlags: splitList(p["anomaly_flags"]),
    exceptionReason: p["exception_reason"] || null,
    channel: p["order_channel"] || null,
    createdAt: p["createdate"] || null,
    supplierName,
  };
}

function toSupplier(o: HsObject): Supplier {
  const p = o.properties;
  return {
    id: o.id,
    name: p["name"] ?? "Unnamed supplier",
    status: p["supplier_status"] || null,
    vatId: p["supplier_vat_id"] || null,
    iban: p["supplier_iban"] || null,
    previousIban: p["previous_iban"] || null,
    ibanChangedOn: p["iban_changed_on"] || null,
    certificateValidUntil: p["tax_certificate_valid_until"] || null,
  };
}

function toPoLine(o: HsObject): PoLine {
  const p = o.properties;
  return {
    id: o.id,
    name: p["name"] ?? "",
    sku: p["hs_sku"] ?? "",
    quantity: num(p["quantity"]) ?? 0,
    price: num(p["price"]) ?? 0,
    receivedQuantity: num(p["received_quantity"]) ?? 0,
    deliveryNoteRef: p["delivery_note_ref"] || null,
  };
}

async function buildPurchaseOrders(deals: HsObject[]): Promise<PurchaseOrder[]> {
  const ids = deals.map((d) => d.id);
  const [{ byDeal }, lineAssoc] = await Promise.all([
    supplierNames(ids),
    readAssoc("deals", "line_items", ids),
  ]);
  const lines = await readObjects("line_items", [...lineAssoc.values()].flat(), PO_LINE_PROPS);
  return deals.map((d) => {
    const p = d.properties;
    const stage = PO_STAGES[p["dealstage"] ?? ""];
    return {
      id: d.id,
      poNumber: p["po_number"] || null,
      budgetCode: p["budget_code"] || null,
      requester: p["po_requester"] || null,
      amount: num(p["amount"]) ?? 0,
      stage: stage?.key ?? "po_open",
      stageLabel: stage?.label ?? "Unknown",
      supplierName: byDeal.get(d.id) ?? null,
      lines: (lineAssoc.get(d.id) ?? [])
        .map((id) => lines.get(id))
        .filter((o): o is HsObject => Boolean(o))
        .map(toPoLine),
    };
  });
}

async function readInvoiceDeal(dealId: string, properties: string[]) {
  const hubspot = await hs();
  const deal = await hubspot<HsObject>(
    `/crm/v3/objects/deals/${dealId}?properties=${properties.join(",")}`,
  );
  if (
    deal.properties["pipeline"] !== P2P_PIPELINE_ID ||
    deal.properties["document_type"] === PO_DOCUMENT_TYPE
  ) {
    throw new Error("This isn't an invoice on the invoice desk.");
  }
  return deal;
}

const DealInput = z.object({ dealId: z.string().regex(/^\d+$/) });

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireInvoiceDesk])
  .handler(async (): Promise<InvoiceSummary[]> => {
    const deals = await searchDeals(false, INVOICE_PROPS);
    const { byDeal } = await supplierNames(deals.map((d) => d.id));
    return deals.map((d) => toSummary(d, byDeal.get(d.id) ?? null));
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireInvoiceDesk])
  .inputValidator((input: { dealId: string }) => DealInput.parse(input))
  .handler(async ({ data }): Promise<InvoiceDetail> => {
    const deal = await readInvoiceDeal(data.dealId, DETAIL_PROPS);
    const p = deal.properties;
    const [companyAssoc, lineAssoc, noteAssoc] = await Promise.all([
      readAssoc("deals", "companies", [deal.id]),
      readAssoc("deals", "line_items", [deal.id]),
      readAssoc("deals", "notes", [deal.id]),
    ]);
    const companyId = companyAssoc.get(deal.id)?.[0];
    const poNumber = p["po_number"];
    const [companies, lineObjs, noteObjs, poDeals] = await Promise.all([
      readObjects("companies", companyId ? [companyId] : [], SUPPLIER_PROPS),
      readObjects("line_items", lineAssoc.get(deal.id) ?? [], [
        "name",
        "hs_sku",
        "quantity",
        "price",
        "amount",
        "po_line_ref",
        "line_check",
        "line_check_note",
      ]),
      readObjects("notes", noteAssoc.get(deal.id) ?? [], ["hs_note_body", "hs_timestamp"]),
      poNumber
        ? searchDeals(true, PO_PROPS, [{ propertyName: "po_number", operator: "EQ", value: poNumber }], 1)
        : Promise.resolve([] as HsObject[]),
    ]);
    const supplierObj = companyId ? companies.get(companyId) : undefined;
    const [po] = poDeals.length ? await buildPurchaseOrders(poDeals) : [];

    return {
      ...toSummary(deal, supplierObj?.properties["name"] ?? null),
      ibanOnInvoice: p["iban_on_invoice"] || null,
      vatAmount: num(p["vat_amount"]),
      rawText: p["raw_order_text"] || null,
      approvedBy: p["approved_by"] || null,
      lines: [...lineObjs.values()].map((o) => ({
        id: o.id,
        name: o.properties["name"] ?? "",
        sku: o.properties["hs_sku"] ?? "",
        quantity: num(o.properties["quantity"]) ?? 0,
        price: num(o.properties["price"]) ?? 0,
        amount: num(o.properties["amount"]) ?? 0,
        poLineRef: o.properties["po_line_ref"] || null,
        lineCheck: splitList(o.properties["line_check"]),
        lineCheckNote: o.properties["line_check_note"] || null,
      })),
      notes: [...noteObjs.values()]
        .map((o) => ({
          id: o.id,
          body: o.properties["hs_note_body"] ?? "",
          timestamp: o.properties["hs_timestamp"] || null,
        }))
        .sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "")),
      supplier: supplierObj ? toSupplier(supplierObj) : null,
      po: po ?? null,
    };
  });

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireInvoiceDesk])
  .handler(async (): Promise<SupplierRow[]> => {
    const hubspot = await hs();
    const [res, invoices] = await Promise.all([
      hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
        body: {
          filterGroups: [{ filters: [{ propertyName: "supplier_status", operator: "HAS_PROPERTY" }] }],
          properties: SUPPLIER_PROPS,
          sorts: [{ propertyName: "name", direction: "ASCENDING" }],
          limit: 200,
        },
      }),
      searchDeals(false, ["dealstage", "pipeline", "document_type"]),
    ]);
    const open = invoices.filter((d) => OPEN_KEYS.has(INVOICE_STAGES[d.properties["dealstage"] ?? ""]?.key ?? ""));
    const assoc = await readAssoc("deals", "companies", open.map((d) => d.id));
    const counts = new Map<string, number>();
    for (const ids of assoc.values()) {
      const cid = ids[0];
      if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
    }
    return res.results.map((o) => ({ ...toSupplier(o), openInvoices: counts.get(o.id) ?? 0 }));
  });

export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireInvoiceDesk])
  .handler(async (): Promise<PurchaseOrder[]> => buildPurchaseOrders(await searchDeals(true, PO_PROPS)));

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export const submitDocument = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk])
  .inputValidator((input: { text?: string; pdfBase64?: string; filename?: string }) =>
    z
      .object({
        text: z.string().max(20_000, "Text can be at most 20,000 characters.").optional(),
        pdfBase64: z
          .string()
          .max(Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4, "The PDF can be at most 5 MB.")
          .optional(),
        filename: z.string().max(200).optional(),
      })
      .refine((d) => Boolean(d.text?.trim() || d.pdfBase64), "Paste text or attach a PDF.")
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    const { n8n } = await import("@/lib/hubspot.server");
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const sourceId = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return n8n<SubmitResult>(
      "invoice-intake",
      {
        source_id: sourceId,
        text: data.text?.trim() || null,
        pdf_base64: data.pdfBase64 ?? null,
        filename: data.filename ?? null,
        submitted_by: (context.claims as { email?: string }).email ?? "",
      },
      120_000,
    );
  });

const DECISIONS = {
  approve: { stage: "approved_for_payment", label: "Approved for payment" },
  send_back: { stage: "waiting_on_supplier", label: "Sent back to supplier" },
  reject: { stage: "rejected", label: "Rejected" },
  duplicate: { stage: "duplicate", label: "Marked duplicate" },
} as const;

export const decideInvoice = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk])
  .inputValidator(
    (input: { dealId: string; decision: keyof typeof DECISIONS; comment: string }) =>
      z
        .object({
          dealId: z.string().regex(/^\d+$/),
          decision: z.enum(["approve", "send_back", "reject", "duplicate"]),
          comment: z.string().max(2000),
        })
        .refine(
          (d) => !(d.decision === "reject" || d.decision === "send_back") || d.comment.trim().length > 0,
          "Add a comment explaining the decision.",
        )
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const hubspot = await hs();
    const email = (context.claims as { email?: string }).email ?? "unknown";
    const deal = await readInvoiceDeal(data.dealId, ["dealstage", "pipeline", "document_type"]);
    const currentKey = INVOICE_STAGES[deal.properties["dealstage"] ?? ""]?.key;
    if (data.decision === "approve" && currentKey !== "ready_to_approve") {
      throw new Error("Only invoices in Ready to approve can be approved for payment.");
    }
    const d = DECISIONS[data.decision];
    const stageId = stageIdFor(d.stage);
    if (!stageId) throw new Error("Unknown stage.");
    await hubspot(`/crm/v3/objects/deals/${deal.id}`, {
      method: "PATCH",
      body: {
        properties: { dealstage: stageId, ...(data.decision === "approve" ? { approved_by: email } : {}) },
      },
    });
    const comment = data.comment.trim();
    await hubspot("/crm/v3/objects/notes", {
      body: {
        properties: {
          hs_note_body: `${d.label} by ${email}${comment ? `: ${comment}` : ""}`,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: deal.id },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
          },
        ],
      },
    });
    return { stage: d.stage };
  });

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk])
  .inputValidator((input: { sessionId: string; message: string; dealId?: string }) =>
    z
      .object({
        sessionId: z.string().min(1).max(100),
        message: z.string().trim().min(1).max(4000),
        dealId: z.string().regex(/^\d+$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { n8n } = await import("@/lib/hubspot.server");
    const res = await n8n<{ reply?: string; output?: string }>("invoice-assistant", {
      session_id: data.sessionId,
      message: data.message,
      deal_id: data.dealId ?? null,
      user_email: (context.claims as { email?: string }).email ?? "",
    });
    return { reply: res.reply ?? res.output ?? "No answer." };
  });
