import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { anomalyLabel, daysBetween } from "@/lib/invoice-rules";
import { listInvoices, listPurchaseOrders, listSuppliers } from "@/lib/invoices";

export const Route = createFileRoute("/app/admin/overview")({
  head: () => ({ meta: [{ title: "Overview — AppBuilder.ai" }] }),
  component: OverviewPage,
});

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

function OverviewPage() {
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
          How the invoice worker is doing, and what's committed on purchase orders.
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
