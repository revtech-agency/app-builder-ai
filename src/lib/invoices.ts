// Server functions for the supplier invoice screens. STUB: returns fixtures for every call until
// the backend work replaces each body with HubSpot / n8n calls. Signatures are the contract the
// screens build against (types in src/lib/invoice-types.ts); don't change them without asking.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FIXTURE_INVOICES, FIXTURE_SUPPLIERS } from "@/lib/invoice-fixtures";
import { MINUTES_PER_CLEAN_INVOICE } from "@/lib/invoice-types";
import type {
  InvoiceDetail,
  InvoiceSummary,
  IntakeResult,
  OverviewStats,
  SupplierInfo,
} from "@/lib/invoice-types";

const toSummary = (d: InvoiceDetail): InvoiceSummary => {
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

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<InvoiceSummary[]> => FIXTURE_INVOICES.map(toSummary));

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) =>
    z.object({ invoiceId: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<InvoiceDetail> => {
    const found = FIXTURE_INVOICES.find((i) => i.id === data.invoiceId);
    if (!found) throw new Error("Invoice not found.");
    return found;
  });

export const decideInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string; decision: "approve" | "reject" }) =>
    z.object({ invoiceId: z.string().min(1), decision: z.enum(["approve", "reject"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<InvoiceSummary> => {
    const found = FIXTURE_INVOICES.find((i) => i.id === data.invoiceId);
    if (!found) throw new Error("Invoice not found.");
    return toSummary({
      ...found,
      stage: data.decision === "approve" ? "approved" : "rejected",
      stageLabel: data.decision === "approve" ? "Approved for payment" : "Rejected",
    });
  });

export const submitInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .handler(
    async (): Promise<IntakeResult> => ({
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
      exception_reason: "Docking stations invoiced at €199.00, PO price €185.00 (+7.6%).",
      lines: [
        {
          name: "USB-C docking station",
          quantity: 20,
          price: 199,
          line_check: "price_off",
          line_check_note: "Invoiced 20 at EUR 199.00; PO price EUR 185.00 (+7.6%).",
        },
      ],
    }),
  );

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; message: string; invoiceId?: string }) =>
    z
      .object({
        sessionId: z.string().min(1).max(100),
        message: z.string().trim().min(1).max(4000),
        invoiceId: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async (): Promise<{ reply: string }> => ({
    reply: "This is a stub reply. The real assistant answers from the invoice, supplier and PO data.",
  }));

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SupplierInfo[]> => FIXTURE_SUPPLIERS);

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<OverviewStats> => {
    const cleared = FIXTURE_INVOICES.filter(
      (i) => (i.stage === "ready_to_approve" || i.stage === "approved") && i.anomalyFlags.length === 0,
    );
    return {
      totalInvoices: FIXTURE_INVOICES.length,
      byStage: [],
      clearedAutomatically: cleared.length,
      clearedAutomaticallyPct: Math.round((cleared.length / FIXTURE_INVOICES.length) * 100),
      exceptionsByFlag: [],
      amountCleared: cleared.reduce((s, i) => s + i.amount, 0),
      amountHeldBack: 0,
      minutesSaved: cleared.length * MINUTES_PER_CLEAN_INVOICE,
    };
  });
