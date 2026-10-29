import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { anomalyLabel, daysBetween } from "@/lib/invoice-rules";
import { listInvoices, listPurchaseOrders, listSuppliers } from "@/lib/invoices";
import type { InvoiceSummary } from "@/lib/invoices";
import { APQC_RISK_RATE, PRICE_PER_INVOICE, RISK_CATEGORIES, riskTotals } from "@/lib/money";

// Assumption for the "time saved" estimate: what a person spends checking one clean invoice.
const MINUTES_PER_CLEAN_INVOICE = 6;

const STAGES = [
  { key: "received", label: "Received", color: "var(--muted-foreground)" },
  { key: "waiting_on_supplier", label: "Waiting", color: "var(--warning)" },
  { key: "needs_review", label: "Review", color: "var(--destructive)" },
  { key: "ready_to_approve", label: "Ready", color: "var(--primary)" },
  { key: "approved_for_payment", label: "Approved", color: "var(--success)" },
  { key: "duplicate", label: "Duplicate", color: "var(--muted-foreground)" },
  { key: "rejected", label: "Rejected", color: "var(--muted-foreground)" },
];

const chartConfig = { count: { label: "Invoices" } } satisfies ChartConfig;

const CLEARED = new Set(["ready_to_approve", "approved_for_payment"]);
const HELD = new Set(["needs_review", "waiting_on_supplier"]);

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const pct = (n: number) => `${(n * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;

// The money the worker kept from going out wrong (src/lib/money.ts), split by reason, and how it
// compares with the benchmark and with what the worker costs.
function MoneyProtected({ invoices }: { invoices: InvoiceSummary[] }) {
  const totals = riskTotals(invoices.map((i) => i.risk));
  const checked = invoices.filter((i) => !i.documentType || i.documentType === "invoice");
  const spend = checked.reduce((s, i) => s + i.amount, 0);
  const cost = checked.length * PRICE_PER_INVOICE;
  const maxCat = Math.max(1, ...Object.values(totals.byCategory).map((c) => c.amount));

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="border-primary lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5" /> Risky payments held before payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(totals.total)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              on {totals.invoices} of {checked.length} invoices. Stopped before payment, not
              recovered after: each invoice counts once, under its main reason.
            </p>
          </div>
          <div className="space-y-3">
            {RISK_CATEGORIES.map((c) => {
              const t = totals.byCategory[c.key];
              return (
                <div key={c.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{c.detail}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold">
                      {formatMoney(t.amount)} · {t.count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(t.amount / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Against the benchmark and the cost</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Supplier spend checked</p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(spend)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">
              Paid twice or wrong at the APQC rate ({pct(APQC_RISK_RATE.low)}–
              {pct(APQC_RISK_RATE.high)})
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(spend * APQC_RISK_RATE.low)}–{formatMoney(spend * APQC_RISK_RATE.high)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">
              Worker cost: {checked.length} invoices × {formatMoney(PRICE_PER_INVOICE)}
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatMoney(cost)}</p>
          </div>
          <div className="rounded-md bg-primary/10 p-3">
            <p className="text-muted-foreground">Held per euro the worker costs</p>
            <p className="text-2xl font-semibold tabular-nums">
              {cost > 0 ? `€${Math.round(totals.total / cost).toLocaleString("en-GB")}` : "—"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Illustrative: the demo uses synthetic invoices built to hit the rules, so the held share
            is far above a real AP team's. At bank scale the deck's example is 20,000 invoices a
            year × €1.50 = €30k, against €0.8–2M at risk per €100M of supplier spend. €1.50 is a
            draft price.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Procure-to-pay overview, shared by the invoice desk (/app/overview) and the admin Overview tab.
export function P2pOverview() {
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => listInvoices() });
  const pos = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders() });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  const inv = invoices.data ?? [];
  const cleared = inv.filter((i) => CLEARED.has(i.stage));
  const held = inv.filter((i) => HELD.has(i.stage));
  const clearedPct = inv.length ? Math.round((cleared.length / inv.length) * 100) : 0;
  const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

  const byStage = STAGES.map((s) => ({
    ...s,
    count: inv.filter((i) => i.stage === s.key).length,
  }));

  // Why held invoices were stopped: the worker's flags, plus PO / line problems.
  const reasons = new Map<string, number>();
  for (const i of held) {
    const keys = [...i.anomalyFlags];
    if (i.matchResult === "mismatch" || i.matchResult === "no_po" || keys.length === 0) {
      keys.push("other");
    }
    for (const k of new Set(keys)) reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }
  const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(1, ...reasonRows.map(([, n]) => n));

  const po = pos.data ?? [];
  const openPos = po.filter((p) => p.stage !== "po_closed");
  const ordered = openPos.flatMap((p) => p.lines).reduce((s, l) => s + l.quantity, 0);
  const received = openPos
    .flatMap((p) => p.lines)
    .reduce((s, l) => s + Math.min(l.receivedQuantity, l.quantity), 0);

  const today = new Date().toISOString().slice(0, 10);
  const attention = (suppliers.data ?? []).filter((s) => {
    const changed = daysBetween(s.ibanChangedOn, today);
    return (
      s.status !== "approved" ||
      !s.certificateValidUntil ||
      s.certificateValidUntil.slice(0, 10) < today ||
      (changed != null && changed >= 0 && changed <= 30)
    );
  });

  const loading = invoices.isLoading || pos.isLoading || suppliers.isLoading;
  const error = invoices.error ?? pos.error ?? suppliers.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The money the invoice worker held before payment, how it is doing, and what's committed on
          purchase orders.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/invoices">
            Go to invoices <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <MoneyProtected invoices={inv} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Cleared automatically"
              value={`${clearedPct}%`}
              hint={`${cleared.length} of ${inv.length} invoices`}
            />
            <Kpi
              label="Time saved (estimate)"
              value={`${cleared.length * MINUTES_PER_CLEAN_INVOICE} min`}
              hint={`about ${MINUTES_PER_CLEAN_INVOICE} minutes per clean invoice`}
            />
            <Kpi
              label="Amount cleared"
              value={formatMoney(sum(cleared))}
              hint="Ready or approved"
            />
            <Kpi
              label="Held back for review"
              value={formatMoney(sum(held))}
              hint="Waiting on a person or the supplier"
            />
            <Kpi
              label="Open purchase orders"
              value={String(openPos.length)}
              hint={`${po.length - openPos.length} closed`}
            />
            <Kpi label="Committed on open POs" value={formatMoney(sum(openPos))} />
            <Kpi
              label="Delivered so far"
              value={`${ordered ? Math.round((received / ordered) * 100) : 0}%`}
              hint={`${received} of ${ordered} units on open POs`}
            />
            <Kpi
              label="Suppliers to check"
              value={String(attention.length)}
              hint="Not approved, certificate expired or IBAN just changed"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices by stage</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={byStage}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={2}>
                    {byStage.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why invoices were stopped</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reasonRows.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing is held back right now.</p>
              )}
              {reasonRows.map(([key, n]) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {key === "other" ? "Other (price, quantity, PO)" : anomalyLabel(key)}
                    </span>
                    <span className="font-mono text-xs font-semibold">{n}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(n / maxReason) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
