// Shared contract for the supplier invoice worker screens (types and constants only, safe in the
// browser). Server functions live in src/lib/invoices.ts. The data comes from the HubSpot
// "Procure-to-pay" pipeline (invoices and purchase orders share it, told apart by `document_type`)
// and the n8n invoice-intake / invoice-assistant webhooks.

export const INVOICE_PIPELINE_ID = "default";

export type InvoiceStageKey =
  | "received"
  | "waiting_on_supplier"
  | "needs_review"
  | "ready_to_approve"
  | "approved"
  | "duplicate"
  | "rejected";

// HubSpot deal stage id -> stable key and label (invoice stages of the Procure-to-pay pipeline).
export const INVOICE_STAGES: Record<string, { key: InvoiceStageKey; label: string }> = {
  "6318170298": { key: "received", label: "Received" },
  "6318170299": { key: "waiting_on_supplier", label: "Waiting on supplier" },
  "6318170300": { key: "needs_review", label: "Needs review" },
  "6318170301": { key: "ready_to_approve", label: "Ready to approve" },
  "6318170302": { key: "approved", label: "Approved for payment" },
  "6318170303": { key: "duplicate", label: "Duplicate" },
  "6318170304": { key: "rejected", label: "Rejected" },
};

export const INVOICE_STAGE_IDS: Record<InvoiceStageKey, string> = {
  received: "6318170298",
  waiting_on_supplier: "6318170299",
  needs_review: "6318170300",
  ready_to_approve: "6318170301",
  approved: "6318170302",
  duplicate: "6318170303",
  rejected: "6318170304",
};

export type InvoiceDocumentType = "invoice" | "credit_note" | "reminder" | "question" | "other";
export type ApprovalLevel = "team_lead" | "head_of_department" | "cfo";
export type MatchResult = "full_match" | "within_tolerance" | "mismatch" | "no_po";
export type LineCheck = "matched" | "price_off" | "qty_off" | "not_on_po";

export type AnomalyFlag =
  | "duplicate"
  | "iban_mismatch"
  | "iban_recently_changed"
  | "unknown_supplier"
  | "supplier_blocked"
  | "split_purchase"
  | "low_confidence"
  | "certificate_expired";

export const APPROVAL_LABELS: Record<ApprovalLevel, string> = {
  team_lead: "Team lead (up to €5,000)",
  head_of_department: "Head of department (up to €25,000)",
  cfo: "CFO (above €25,000)",
};

export const FLAG_LABELS: Record<AnomalyFlag, string> = {
  duplicate: "Duplicate invoice",
  iban_mismatch: "IBAN differs from the one on file",
  iban_recently_changed: "IBAN changed recently",
  unknown_supplier: "Unknown supplier",
  supplier_blocked: "Supplier not approved",
  split_purchase: "Possible split purchase",
  low_confidence: "Low extraction confidence",
  certificate_expired: "Tax certificate expired or missing",
};

export type InvoiceSummary = {
  id: string; // HubSpot deal id
  ref: string; // supplier's invoice number (or document type when there is none)
  supplierId: string | null; // HubSpot company id
  supplierName: string;
  stage: InvoiceStageKey;
  stageLabel: string;
  documentType: InvoiceDocumentType;
  amount: number; // total incl. VAT, EUR
  invoiceDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  poNumber: string | null;
  matchResult: MatchResult | null;
  approvalLevel: ApprovalLevel | null;
  anomalyFlags: AnomalyFlag[];
  exceptionReason: string | null;
  channel: string | null; // email | app
  createdAt: string;
};

export type InvoiceLineItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  check: LineCheck | null;
  checkNote: string | null;
  confidence: number | null; // 0..1
};

// One tick/cross row of the audit note the invoice worker writes on the deal.
export type AuditCheck = { ok: boolean; name: string; detail: string };

export type InvoiceDetail = InvoiceSummary & {
  ibanOnInvoice: string | null;
  vatAmount: number | null;
  minFieldConfidence: number | null;
  rawText: string | null;
  lines: InvoiceLineItem[];
  audit: AuditCheck[];
  approvedBy: string | null;
  // Whether the signed-in user may approve or reject this invoice (admins: any level; the demo
  // reviewer: only team-lead level). When false, `cannotDecideReason` says why.
  canDecide: boolean;
  cannotDecideReason: string | null;
};

export type DecideInput = { invoiceId: string; decision: "approve" | "reject" };

// Mirrors the JSON the n8n "Process supplier invoices" webhook returns.
export type IntakeResult = {
  deal_id: string | null;
  stage: string; // worker stage key, e.g. "needs_review"
  stage_label: string;
  document_type: InvoiceDocumentType;
  supplier_name: string;
  invoice_number: string;
  amount: number;
  match_result: MatchResult | "" | null;
  approval_level: ApprovalLevel | "" | null;
  anomaly_flags: AnomalyFlag[];
  exception_reason: string;
  lines: { name: string; quantity: number; price: number; line_check: LineCheck; line_check_note: string }[];
  supplier_email_draft?: string;
  already_processed?: boolean;
};

export type IntakeInput = {
  text?: string;
  pdfBase64?: string;
  filename?: string;
};

export type AssistantInput = { sessionId: string; message: string; invoiceId?: string };

export type SupplierInfo = {
  id: string;
  name: string;
  status: "approved" | "pending_onboarding" | "blocked" | string;
  vatId: string | null;
  iban: string | null;
  previousIban: string | null;
  ibanChangedOn: string | null;
  taxCertificateValidUntil: string | null;
  certificateExpired: boolean;
  openInvoices: number;
};

export type OverviewStats = {
  totalInvoices: number;
  byStage: { stage: InvoiceStageKey; label: string; count: number; amount: number }[];
  // Invoices that reached "ready to approve" or "approved" with no anomaly flag.
  clearedAutomatically: number;
  clearedAutomaticallyPct: number; // 0..100
  exceptionsByFlag: { flag: AnomalyFlag | "other"; label: string; count: number }[];
  amountCleared: number;
  amountHeldBack: number; // value of invoices stopped for a person or the supplier
  minutesSaved: number; // clearedAutomatically * MINUTES_PER_CLEAN_INVOICE
};

export const MINUTES_PER_CLEAN_INVOICE = 6;
