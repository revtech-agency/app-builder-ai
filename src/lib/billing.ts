// Pure AppBuilder.ai revenue model: a monthly subscription plus a fee per billable order.
// Kept free of server imports so the dashboard and unit tests can share it.

export const CURRENCY = "EUR";

// Deal stages that don't count as billable orders (Duplicate, Rejected).
const NON_BILLABLE_STAGES = new Set(["6315918558", "6315918559"]);

export type BillingOrder = { createdAt: string; stage: string; amount: number };

export type ClientPlan = {
  monthlyFee: number | null;
  feePerOrder: number | null;
  // YYYY-MM-DD
  start: string | null;
};

export type MonthBilling = {
  month: string;
  orders: number;
  subscription: number;
  usage: number;
  revenue: number;
};

export type ClientBilling = {
  hasPlan: boolean;
  monthly: MonthBilling[];
  ordersThisMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueToDate: number;
  orderValueToDate: number;
  // Subscription has started, so the client counts towards MRR and active clients.
  active: boolean;
};

export type DashboardTotals = {
  mrr: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  billableOrdersThisMonth: number;
  activeClients: number;
  revenueToDate: number;
  orderValueToDate: number;
};

export const isBillableStage = (stageId: string) => !NON_BILLABLE_STAGES.has(stageId);

const round2 = (n: number) => Math.round(n * 100) / 100;

// "YYYY-MM" from an ISO date or timestamp (UTC), or null if it isn't one.
export function monthOf(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(value ?? "");
  return m ? `${m[1]}-${m[2]}` : null;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

// Inclusive list of months, oldest first. Empty if `from` is after `to`.
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let m = from;
  while (m <= to && out.length < 600) {
    out.push(m);
    const [y = 0, mo = 1] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

// The months a dashboard covers: earliest subscription start through the current month.
export function dashboardMonths(starts: (string | null)[], now: Date = new Date()): string[] {
  const cur = currentMonth(now);
  const first = starts
    .map(monthOf)
    .filter((m): m is string => m !== null && m <= cur)
    .sort()[0];
  return monthRange(first ?? cur, cur);
}

export function computeClientBilling(
  plan: ClientPlan,
  orders: BillingOrder[],
  months: string[],
  now: Date = new Date(),
): ClientBilling {
  const startMonth = monthOf(plan.start);
  const hasPlan = plan.monthlyFee !== null && plan.feePerOrder !== null && startMonth !== null;
  const cur = currentMonth(now);
  const prev = previousMonth(cur);

  const billable = orders.filter((o) => isBillableStage(o.stage));
  const counts = new Map<string, number>();
  for (const o of billable) {
    const m = monthOf(o.createdAt);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  const monthly = months.map((month): MonthBilling => {
    const count = counts.get(month) ?? 0;
    const started = hasPlan && startMonth !== null && month >= startMonth;
    const subscription = started ? round2(plan.monthlyFee ?? 0) : 0;
    const usage = started ? round2(count * (plan.feePerOrder ?? 0)) : 0;
    return { month, orders: count, subscription, usage, revenue: round2(subscription + usage) };
  });

  const revenueIn = (month: string) => monthly.find((m) => m.month === month)?.revenue ?? 0;
  return {
    hasPlan,
    monthly,
    ordersThisMonth: counts.get(cur) ?? 0,
    revenueThisMonth: revenueIn(cur),
    revenueLastMonth: revenueIn(prev),
    revenueToDate: round2(monthly.reduce((s, m) => s + m.revenue, 0)),
    orderValueToDate: round2(billable.reduce((s, o) => s + (o.amount || 0), 0)),
    active: hasPlan && startMonth !== null && startMonth <= cur,
  };
}

export function computeTotals(
  clients: {
    monthlyFee: number | null;
    billing: ClientBilling;
  }[],
): DashboardTotals {
  const sum = (f: (c: (typeof clients)[number]) => number) =>
    round2(clients.reduce((s, c) => s + f(c), 0));
  return {
    mrr: sum((c) => (c.billing.active ? (c.monthlyFee ?? 0) : 0)),
    revenueThisMonth: sum((c) => c.billing.revenueThisMonth),
    revenueLastMonth: sum((c) => c.billing.revenueLastMonth),
    billableOrdersThisMonth: clients.reduce((s, c) => s + c.billing.ordersThisMonth, 0),
    activeClients: clients.filter((c) => c.billing.active).length,
    revenueToDate: sum((c) => c.billing.revenueToDate),
    orderValueToDate: sum((c) => c.billing.orderValueToDate),
  };
}
