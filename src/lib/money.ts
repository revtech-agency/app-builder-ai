// Money the invoice worker kept from going out wrong: the euro side of the 12 checks.
// "Held" means stopped before payment, not recovered afterwards: nothing in the demo was paid.
// Pure, so the queue, the overview, the invoice page and the tests share one definition. The
// n8n result email works out the same figure in its "Build Notification" node; the email-intake
// test runs that node against this function.

export type RiskLine = {
  quantity: number;
  price: number;
  lineCheck: string[];
  // The matched PO line, when there is one.
  poPrice: number | null;
  receivedQuantity: number | null;
};

export type RiskInput = {
  amount: number;
  stage: string;
  anomalyFlags: string[];
  matchResult: string | null;
  documentType: string | null;
  lines: RiskLine[];
};

export type RiskCategory = "duplicate" | "payee" | "split_purchase" | "no_po" | "overbilling";

export type Risk = {
  // The main reason the money was at risk; null when nothing was.
  category: RiskCategory | null;
  // Euros held, incl. VAT: the whole invoice for duplicates, unverified payees, split purchases
  // and missing POs; the overbilled part otherwise.
  amount: number;
  // Euros billed above the PO price, above what was delivered, or for items not on the PO,
  // incl. VAT. Shown on its own even when the whole invoice is held for another reason.
  overbilling: number;
};

// Highest first: an invoice counts once, under the first category that applies.
export const RISK_CATEGORIES: { key: RiskCategory; label: string; detail: string }[] = [
  {
    key: "duplicate",
    label: "Duplicates stopped",
    detail: "Invoices already received: not paid twice",
  },
  {
    key: "payee",
    label: "Unverified payees held",
    detail: "IBAN different or just changed, unknown or unapproved supplier",
  },
  {
    key: "split_purchase",
    label: "Split purchases flagged",
    detail: "Invoices on one PO kept just under an approval limit",
  },
  { key: "no_po", label: "No approved order", detail: "No purchase order behind the invoice" },
  {
    key: "overbilling",
    label: "Overbilling found",
    detail: "Price above the PO, more than delivered, or items not ordered",
  },
];

export const riskLabel = (c: RiskCategory) => RISK_CATEGORIES.find((r) => r.key === c)?.label ?? c;

const PAYEE_FLAGS = [
  "iban_mismatch",
  "iban_recently_changed",
  "unknown_supplier",
  "supplier_blocked",
];

const round2 = (n: number) => Math.round(n * 100) / 100;

// Net euros a line is billed beyond what the PO and the delivery support.
export function lineExcess(l: RiskLine): number {
  if (l.lineCheck.includes("not_on_po")) return Math.max(0, l.quantity * l.price);
  let excess = 0;
  if (l.lineCheck.includes("price_off") && l.poPrice != null && l.price > l.poPrice) {
    excess += (l.price - l.poPrice) * l.quantity;
  }
  if (l.lineCheck.includes("qty_off") && l.receivedQuantity != null) {
    const over = l.quantity - l.receivedQuantity;
    if (over > 0) excess += over * Math.min(l.price, l.poPrice ?? l.price);
  }
  return excess;
}

export function invoiceRisk(i: RiskInput): Risk {
  const none: Risk = { category: null, amount: 0, overbilling: 0 };
  if (i.documentType && i.documentType !== "invoice") return none;
  const amount = Math.max(0, i.amount);
  // Line totals are net; scale to the invoice total so every figure includes VAT.
  const net = i.lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const vatFactor = net > 0 && amount > 0 ? amount / net : 1;
  const overbilling = round2(i.lines.reduce((s, l) => s + lineExcess(l), 0) * vatFactor);
  const flags = new Set(i.anomalyFlags);

  let category: RiskCategory | null = null;
  if (i.stage === "duplicate" || flags.has("duplicate")) category = "duplicate";
  else if (PAYEE_FLAGS.some((f) => flags.has(f))) category = "payee";
  else if (flags.has("split_purchase")) category = "split_purchase";
  else if (i.matchResult === "no_po") category = "no_po";
  else if (overbilling > 0) category = "overbilling";

  if (!category) return { ...none, overbilling };
  return { category, amount: category === "overbilling" ? overbilling : amount, overbilling };
}

export type RiskTotals = {
  total: number;
  invoices: number;
  byCategory: Record<RiskCategory, { amount: number; count: number }>;
};

export function riskTotals(risks: Risk[]): RiskTotals {
  const byCategory = Object.fromEntries(
    RISK_CATEGORIES.map((c) => [c.key, { amount: 0, count: 0 }]),
  ) as RiskTotals["byCategory"];
  let total = 0;
  let invoices = 0;
  for (const r of risks) {
    if (!r.category) continue;
    byCategory[r.category].amount += r.amount;
    byCategory[r.category].count += 1;
    total += r.amount;
    invoices += 1;
  }
  for (const c of Object.values(byCategory)) c.amount = round2(c.amount);
  return { total: round2(total), invoices, byCategory };
}

// Benchmark from the deck (Q&A slide 12): APQC puts duplicate or erroneous supplier payments at
// 0.8% of payments for top performers and about 2% for bottom performers.
export const APQC_RISK_RATE = { low: 0.008, high: 0.02 } as const;
// Draft price per invoice matched (deck, business model slide).
export const PRICE_PER_INVOICE = 1.5;
