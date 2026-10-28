// Pure invoice-desk rules shared by the invoice server functions and the UI.
// Mirrors the n8n invoice worker: three-way match, price tolerance and approval limits.

// Purchase orders and invoices share this one deal pipeline ("Procure-to-pay").
// Never read or write the casings Orders pipeline from invoice code.
export const P2P_PIPELINE_ID = "default";
export const PO_DOCUMENT_TYPE = "purchase_order";

export const INVOICE_STAGES: Record<string, { key: string; label: string }> = {
  "6318170298": { key: "received", label: "Received" },
  "6318170299": { key: "waiting_on_supplier", label: "Waiting on supplier" },
  "6318170300": { key: "needs_review", label: "Needs review" },
  "6318170301": { key: "ready_to_approve", label: "Ready to approve" },
  "6318170302": { key: "approved_for_payment", label: "Approved for payment" },
  "6318170303": { key: "duplicate", label: "Duplicate" },
  "6318170304": { key: "rejected", label: "Rejected" },
};

export const PO_STAGES: Record<string, { key: string; label: string }> = {
  "6318169334": { key: "po_open", label: "PO open" },
  "6318169335": { key: "po_partly_received", label: "PO partly received" },
  "6318169336": { key: "po_fully_received", label: "PO fully received" },
  "6318169337": { key: "po_closed", label: "PO closed" },
};

export const poStageIdFor = (key: string) =>
  Object.entries(PO_STAGES).find(([, s]) => s.key === key)?.[0] ?? null;

// A PO's stage follows its delivery notes; only closing it is a manual step.
export function poStageFor(
  lines: { quantity: number; receivedQuantity: number }[],
  closed: boolean,
) {
  if (closed) return "po_closed";
  const received = lines.filter((l) => l.receivedQuantity > 0);
  if (received.length === 0) return "po_open";
  return lines.every((l) => l.receivedQuantity >= l.quantity)
    ? "po_fully_received"
    : "po_partly_received";
}

export const stageIdFor = (key: string) =>
  Object.entries(INVOICE_STAGES).find(([, s]) => s.key === key)?.[0] ?? null;

export const PRICE_TOLERANCE = 0.02;

export const APPROVAL_LIMITS = { team_lead: 5000, head_of_department: 25000 } as const;

export type ApprovalLevel = "team_lead" | "head_of_department" | "cfo";

export function approvalLevelFor(total: number): ApprovalLevel {
  if (total <= APPROVAL_LIMITS.team_lead) return "team_lead";
  if (total <= APPROVAL_LIMITS.head_of_department) return "head_of_department";
  return "cfo";
}

export const APPROVAL_LABELS: Record<string, string> = {
  team_lead: "team lead",
  head_of_department: "head of department",
  cfo: "CFO",
};

export const ANOMALY_LABELS: Record<string, string> = {
  duplicate: "Possible duplicate invoice",
  iban_mismatch: "IBAN differs from the one on file",
  iban_recently_changed: "Supplier IBAN changed recently",
  split_purchase: "Looks like a split purchase",
  unknown_supplier: "Supplier not in the vendor list",
  supplier_blocked: "Supplier is blocked",
  certificate_expired: "Tax certificate expired",
  low_confidence: "Document read with low confidence",
};

export const DANGER_ANOMALIES = new Set([
  "iban_mismatch",
  "iban_recently_changed",
  "split_purchase",
]);

export const anomalyLabel = (flag: string) => ANOMALY_LABELS[flag] ?? flag.replace(/_/g, " ");

export const splitList = (v: string | null | undefined) =>
  (v ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

export const normIban = (v: string | null | undefined) =>
  (v ?? "").replace(/\s+/g, "").toUpperCase();

const DAY = 86_400_000;

export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY);
}

export type CheckInput = {
  stageKey: string;
  invoiceDate: string | null;
  ibanOnInvoice: string | null;
  anomalyFlags: string[];
  supplier: {
    status: string | null;
    iban: string | null;
    ibanChangedOn: string | null;
    certificateValidUntil: string | null;
  } | null;
  poFound: boolean;
  lineChecks: string[][];
};

export type Check = { label: string; passed: boolean };

// The reviewer sees every rule, passed or failed, derived from the stored data.
export function invoiceChecks(i: CheckInput): Check[] {
  const flags = new Set(i.anomalyFlags);
  const s = i.supplier;
  const ibanMatches =
    !flags.has("iban_mismatch") &&
    (!i.ibanOnInvoice || !s?.iban || normIban(i.ibanOnInvoice) === normIban(s.iban));
  const changedDays = daysBetween(s?.ibanChangedOn ?? null, i.invoiceDate);
  const recentlyChanged =
    flags.has("iban_recently_changed") ||
    (changedDays != null && changedDays >= 0 && changedDays <= 30);
  const certOk =
    !flags.has("certificate_expired") &&
    (!s?.certificateValidUntil ||
      !i.invoiceDate ||
      new Date(s.certificateValidUntil).getTime() >= new Date(i.invoiceDate).getTime());
  const allChecks = i.lineChecks.flat();
  return [
    {
      label: "Supplier approved",
      passed:
        s?.status === "approved" &&
        !flags.has("supplier_blocked") &&
        !flags.has("unknown_supplier"),
    },
    { label: "IBAN matches file", passed: ibanMatches },
    { label: "IBAN not recently changed", passed: !recentlyChanged },
    { label: "Not a duplicate", passed: !flags.has("duplicate") && i.stageKey !== "duplicate" },
    { label: "PO found", passed: i.poFound },
    { label: "Prices within 2%", passed: i.poFound && !allChecks.includes("price_off") },
    { label: "Quantities delivered", passed: i.poFound && !allChecks.includes("qty_off") },
    { label: "Tax certificate valid", passed: Boolean(s?.certificateValidUntil) && certOk },
    { label: "Confidence ≥ 0.8", passed: !flags.has("low_confidence") },
  ];
}

// Plain-English reason per failed check, used to start the reviewer's decision comment.
// Keyed by the labels invoiceChecks returns; the test keeps the two in step.
export const CHECK_REASONS: Record<string, string> = {
  "Supplier approved": "the supplier isn't approved in the vendor list",
  "IBAN matches file": "the IBAN on the invoice differs from the one on file",
  "IBAN not recently changed":
    "the supplier's IBAN changed in the last 30 days and needs a call-back check",
  "Not a duplicate": "an invoice with this number was already received",
  "PO found": "no matching purchase order was found",
  "Prices within 2%": "some prices differ from the PO by more than 2%",
  "Quantities delivered": "some quantities are higher than what was delivered",
  "Tax certificate valid": "the supplier's tax certificate is missing or expired",
  "Confidence ≥ 0.8": "parts of the document couldn't be read reliably",
};

// A starting comment for the decision dialog; the reviewer edits it before saving.
export function suggestedComment(
  decision: "send_back" | "reject" | "duplicate",
  checks: Check[],
): string {
  if (decision === "duplicate") return "Duplicate of an invoice we already received.";
  const reasons = checks.filter((c) => !c.passed).map((c) => CHECK_REASONS[c.label] ?? c.label);
  if (reasons.length === 0) return "";
  const list = reasons.join("; ");
  return decision === "send_back"
    ? `Sent back because ${list}. Please send a corrected invoice.`
    : `Rejected because ${list}.`;
}

// The demo's sample history (loaded by scripts/hubspot/setup-invoices.ts): each invoice's
// source_message_id with the stage and approver it starts in. "Reset demo" restores these and
// archives every other invoice.
export const DEMO_HISTORY: Record<string, { stage: string; approvedBy: string | null }> = {
  "demo-INV-H1": { stage: "approved_for_payment", approvedBy: "daniel@appbuilder.ai" },
  "demo-INV-H2": { stage: "approved_for_payment", approvedBy: "daniel@appbuilder.ai" },
  "demo-INV-H3": { stage: "ready_to_approve", approvedBy: null },
  "demo-INV-H4": { stage: "ready_to_approve", approvedBy: null },
  "demo-INV-H5": { stage: "approved_for_payment", approvedBy: "daniel@appbuilder.ai" },
  "demo-INV-H6": { stage: "needs_review", approvedBy: null },
};

// The audit note the setup script wrote on each history invoice; every other note on them
// (reviewer decisions made during a demo) is removed by "Reset demo".
export const isHistoryAuditNote = (body: string | null | undefined) =>
  (body ?? "").includes("AppBuilder.ai invoice worker · INV-H");

// Applies a "Reset demo" result to the queue the browser already has: drops the archived
// invoices and puts restored samples back in their stage. HubSpot's search lags a few seconds
// behind, so refetching straight away would still show the removed invoices.
export function applyDemoReset<
  T extends { id: string; stage: string; stageId: string; stageLabel: string },
>(list: T[], reset: { archivedIds: string[]; restored: { id: string; stage: string }[] }): T[] {
  const removed = new Set(reset.archivedIds);
  const restored = new Map(reset.restored.map((r) => [r.id, r.stage]));
  return list
    .filter((i) => !removed.has(i.id))
    .map((i) => {
      const key = restored.get(i.id);
      const stageId = key ? stageIdFor(key) : null;
      return key && stageId
        ? { ...i, stage: key, stageId, stageLabel: INVOICE_STAGES[stageId]?.label ?? i.stageLabel }
        : i;
    });
}
