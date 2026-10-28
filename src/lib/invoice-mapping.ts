// Pure helpers for the invoice server functions: HubSpot -> contract mapping, audit-note parsing,
// decision permission and the overview maths. No I/O here so it can be unit tested.
import { FLAG_LABELS, INVOICE_STAGES, MINUTES_PER_CLEAN_INVOICE } from "@/lib/invoice-types";
import type {
  ApprovalLevel,
  AnomalyFlag,
  AuditCheck,
  InvoiceDocumentType,
  InvoiceLineItem,
  InvoiceStageKey,
  InvoiceSummary,
  LineCheck,
  MatchResult,
  OverviewStats,
} from "@/lib/invoice-types";

export type Props = Record<string, string | null | undefined>;
export type HsObject = { id: string; properties: Props };

export const STAGE_ORDER: InvoiceStageKey[] = [
  "received",
  "waiting_on_supplier",
  "needs_review",
  "ready_to_approve",
  "approved",
  "duplicate",
  "rejected",
];

export const ANOMALY_FLAGS = Object.keys(FLAG_LABELS) as AnomalyFlag[];

export function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function stageOf(stageId: string | null | undefined): { key: InvoiceStageKey; label: string } {
  return INVOICE_STAGES[stageId ?? ""] ?? { key: "received", label: "Received" };
}

export function parseFlags(raw: string | null | undefined): AnomalyFlag[] {
  const known = new Set<string>(ANOMALY_FLAGS);
  const out: AnomalyFlag[] = [];
  for (const part of (raw ?? "").split(";")) {
    const f = part.trim();
    if (known.has(f) && !out.includes(f as AnomalyFlag)) out.push(f as AnomalyFlag);
  }
  return out;
}

const DOC_TYPES: InvoiceDocumentType[] = ["invoice", "credit_note", "reminder", "question", "other"];
const MATCH: MatchResult[] = ["full_match", "within_tolerance", "mismatch", "no_po"];
const LEVELS: ApprovalLevel[] = ["team_lead", "head_of_department", "cfo"];
const LINE_CHECKS: LineCheck[] = ["matched", "price_off", "qty_off", "not_on_po"];

const pick = <T extends string>(allowed: T[], v: string | null | undefined): T | null =>
  v && (allowed as string[]).includes(v) ? (v as T) : null;

export function toSummary(
  d: HsObject,
  supplier: { id: string; name: string } | null,
): InvoiceSummary {
  const p = d.properties;
  const stage = stageOf(p["dealstage"]);
  const docType = pick(DOC_TYPES, p["document_type"]) ?? "other";
  const dealname = p["dealname"] ?? "";
  const ref = p["invoice_number"] || dealname.split(" · ")[0] || docType;
  return {
    id: d.id,
    ref,
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? (dealname.split(" · ")[1] || "Unknown supplier"),
    stage: stage.key,
    stageLabel: stage.label,
    documentType: docType,
    amount: num(p["amount"]) ?? 0,
    invoiceDate: p["invoice_date"] || null,
    dueDate: p["due_date"] || null,
    poNumber: p["po_number"] || null,
    matchResult: pick(MATCH, p["match_result"]),
    approvalLevel: pick(LEVELS, p["approval_level"]),
    anomalyFlags: parseFlags(p["anomaly_flags"]),
    exceptionReason: p["exception_reason"] || null,
    channel: p["order_channel"] || null,
    createdAt: p["createdate"] ?? "",
  };
}

export function toLineItem(o: HsObject): InvoiceLineItem {
  const p = o.properties;
  return {
    id: o.id,
    name: p["name"] ?? "",
    sku: p["hs_sku"] || null,
    quantity: num(p["quantity"]) ?? 0,
    price: num(p["price"]) ?? 0,
    check: pick(LINE_CHECKS, p["line_check"]),
    checkNote: p["line_check_note"] || null,
    confidence: num(p["field_confidence"]),
  };
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export function isAuditNote(body: string | null | undefined): boolean {
  return /invoice worker audit/i.test(body ?? "");
}

// Parses the <li> rows of the audit note: "&#10003; Name: detail" (ok) / "&#10007; Name: detail".
export function parseAuditNote(html: string | null | undefined): AuditCheck[] {
  const out: AuditCheck[] = [];
  for (const m of (html ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = decodeEntities((m[1] ?? "").replace(/<[^>]+>/g, "")).trim();
    const first = text.charAt(0);
    const ok = first === "✓" || first === "✔";
    const bad = first === "✗" || first === "✘" || first === "✕";
    if (!ok && !bad) continue;
    const rest = text.slice(1).trim();
    const idx = rest.indexOf(": ");
    out.push(
      idx === -1
        ? { ok, name: rest, detail: "" }
        : { ok, name: rest.slice(0, idx).trim(), detail: rest.slice(idx + 2).trim() },
    );
  }
  return out;
}

// Newest audit note by hs_createdate / hs_timestamp.
export function latestAudit(notes: HsObject[]): AuditCheck[] {
  const audits = notes
    .filter((n) => isAuditNote(n.properties["hs_note_body"]))
    .sort((a, b) =>
      (b.properties["hs_timestamp"] ?? b.properties["hs_createdate"] ?? "").localeCompare(
        a.properties["hs_timestamp"] ?? a.properties["hs_createdate"] ?? "",
      ),
    );
  return audits[0] ? parseAuditNote(audits[0].properties["hs_note_body"]) : [];
}

export const DECIDABLE_STAGES: InvoiceStageKey[] = ["ready_to_approve", "needs_review"];

const LEVEL_REASON: Record<ApprovalLevel, string> = {
  team_lead: "Team-lead approval is needed for this amount.",
  head_of_department: "Head-of-department approval is needed for this amount.",
  cfo: "CFO approval is needed for this amount.",
};

// Admins may decide any level; the demo reviewer only team_lead; everyone else nothing.
export function decisionPermission(args: {
  stage: InvoiceStageKey;
  approvalLevel: ApprovalLevel | null;
  isAdmin: boolean;
  isDemo: boolean;
  // Reminders, questions and other documents are never approved for payment.
  documentType?: string;
}): { canDecide: boolean; cannotDecideReason: string | null } {
  const { stage, approvalLevel, isAdmin, isDemo, documentType } = args;
  if (documentType && documentType !== "invoice" && documentType !== "credit_note") {
    return {
      canDecide: false,
      cannotDecideReason: "Only invoices and credit notes can be approved for payment.",
    };
  }
  if (stage === "approved") return { canDecide: false, cannotDecideReason: "Already approved." };
  if (stage === "rejected") return { canDecide: false, cannotDecideReason: "Already rejected." };
  if (stage === "duplicate") {
    return { canDecide: false, cannotDecideReason: "This invoice is a duplicate and is not paid." };
  }
  if (!DECIDABLE_STAGES.includes(stage)) {
    return {
      canDecide: false,
      cannotDecideReason:
        stage === "waiting_on_supplier"
          ? "Waiting on the supplier to reply before it can be decided."
          : "This invoice is still being processed.",
    };
  }
  if (isAdmin) return { canDecide: true, cannotDecideReason: null };
  if (isDemo) {
    if (approvalLevel === "team_lead") return { canDecide: true, cannotDecideReason: null };
    return {
      canDecide: false,
      cannotDecideReason: approvalLevel
        ? LEVEL_REASON[approvalLevel]
        : "No approval level is set for this invoice.",
    };
  }
  return { canDecide: false, cannotDecideReason: "You don't have permission to approve invoices." };
}

export const isDemoEmail = (email: string, demoEmail?: string) =>
  email.trim().toLowerCase() === (demoEmail || "demo@appbuilder.ai").trim().toLowerCase();

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeOverview(invoices: InvoiceSummary[]): OverviewStats {
  const byStage = STAGE_ORDER.map((stage) => {
    const label = Object.values(INVOICE_STAGES).find((s) => s.key === stage)?.label ?? stage;
    const inStage = invoices.filter((i) => i.stage === stage);
    return {
      stage,
      label,
      count: inStage.length,
      amount: round2(inStage.reduce((s, i) => s + i.amount, 0)),
    };
  });

  const cleared = invoices.filter(
    (i) => (i.stage === "ready_to_approve" || i.stage === "approved") && i.anomalyFlags.length === 0,
  );
  const held = invoices.filter(
    (i) => i.stage === "needs_review" || i.stage === "waiting_on_supplier" || i.stage === "duplicate",
  );

  const exceptionsByFlag: OverviewStats["exceptionsByFlag"] = [];
  for (const flag of ANOMALY_FLAGS) {
    const count = invoices.filter((i) => i.anomalyFlags.includes(flag)).length;
    if (count > 0) exceptionsByFlag.push({ flag, label: FLAG_LABELS[flag], count });
  }
  const other = invoices.filter(
    (i) => (i.stage === "needs_review" || i.stage === "waiting_on_supplier") && i.anomalyFlags.length === 0,
  ).length;
  if (other > 0) exceptionsByFlag.push({ flag: "other", label: "Other (price, quantity, PO)", count: other });
  exceptionsByFlag.sort((a, b) => b.count - a.count);

  return {
    totalInvoices: invoices.length,
    byStage,
    clearedAutomatically: cleared.length,
    clearedAutomaticallyPct: invoices.length ? Math.round((cleared.length / invoices.length) * 100) : 0,
    exceptionsByFlag,
    amountCleared: round2(cleared.reduce((s, i) => s + i.amount, 0)),
    amountHeldBack: round2(held.reduce((s, i) => s + i.amount, 0)),
    minutesSaved: cleared.length * MINUTES_PER_CLEAN_INVOICE,
  };
}

export const OPEN_EXCLUDED_STAGES: InvoiceStageKey[] = ["approved", "rejected", "duplicate"];
