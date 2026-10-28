import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { formatEur } from "@/lib/format";
import { FLAG_LABELS, MINUTES_PER_CLEAN_INVOICE } from "@/lib/invoice-types";
import type { AnomalyFlag } from "@/lib/invoice-types";
import { getOverview } from "@/lib/invoices";

export const Route = createFileRoute("/app/overview")({
  head: () => ({ meta: [{ title: "Overview — AppBuilder.ai" }] }),
  component: OverviewPage,
});

const chartConfig = {
  count: { label: "Invoices", color: "var(--chart-1)" },
} satisfies ChartConfig;

const STAGE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function OverviewPage() {
  const overview = useQuery({ queryKey: ["invoice-overview"], queryFn: () => getOverview() });
  const o = overview.data;
  const maxFlag = o ? Math.max(1, ...o.exceptionsByFlag.map((f) => f.count)) : 1;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/invoices">
            Go to invoices <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {overview.isLoading && <p className="text-sm text-muted-foreground">Loading overview…</p>}
      {overview.isError && <p className="text-sm text-destructive">{overview.error.message}</p>}

      {o && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Cleared automatically"
              value={`${Math.round(o.clearedAutomaticallyPct)}%`}
              note={`${o.clearedAutomatically} of ${o.totalInvoices} invoices`}
            />
            <Stat
              label="Time saved"
              value={formatDuration(o.minutesSaved)}
              note={`about ${MINUTES_PER_CLEAN_INVOICE} minutes per clean invoice`}
            />
            <Stat label="Amount cleared" value={formatEur(o.amountCleared)} />
            <Stat
              label="Held back for review"
              value={formatEur(o.amountHeldBack)}
              note="Waiting on a person or the supplier"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoices by stage</CardTitle>
            </CardHeader>
            <CardContent>
              {o.byStage.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={o.byStage}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      fontSize={11}
                    />
                    <YAxis width={32} allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
                    <Bar dataKey="count" radius={4}>
                      {o.byStage.map((s, i) => (
                        <Cell key={s.stage} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why invoices were stopped</CardTitle>
            </CardHeader>
            <CardContent>
              {o.exceptionsByFlag.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices have been stopped.</p>
              ) : (
                <ul className="space-y-3">
                  {o.exceptionsByFlag.map((f) => (
                    <li key={f.flag} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{f.label || FLAG_LABELS[f.flag as AnomalyFlag] || f.flag}</span>
                        <Badge variant="outline">{f.count}</Badge>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-chart-1"
                          style={{ width: `${(f.count / maxFlag) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
