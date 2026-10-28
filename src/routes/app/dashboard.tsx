import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { getPlatformDashboard } from "@/lib/dashboard";
import { formatDate, formatEur } from "@/lib/format";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AppBuilder.ai" }] }),
  component: DashboardPage,
});

const chartConfig = {
  subscription: { label: "Subscription", color: "var(--chart-1)" },
  usage: { label: "Usage", color: "var(--chart-2)" },
} satisfies ChartConfig;

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

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

function changeNote(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "No change vs last month" : "No revenue last month";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs last month (${formatEur(previous)})`;
}

function DashboardPage() {
  const { isAdmin } = useAuth();
  const dashboard = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: () => getPlatformDashboard(),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">This page is for admins only.</p>;
  }

  const d = dashboard.data;
  const chartData = d?.months.map((month, i) => ({
    month: monthLabel(month),
    subscription: d.clients.reduce((s, c) => s + (c.monthly[i]?.subscription ?? 0), 0),
    usage: d.clients.reduce((s, c) => s + (c.monthly[i]?.usage ?? 0), 0),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {dashboard.isLoading && <p className="text-sm text-muted-foreground">Loading dashboard…</p>}
      {dashboard.isError && <p className="text-sm text-destructive">{dashboard.error.message}</p>}
      {d && chartData && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="MRR" value={formatEur(d.totals.mrr)} />
            <Stat
              label="Revenue this month"
              value={formatEur(d.totals.revenueThisMonth)}
              note={changeNote(d.totals.revenueThisMonth, d.totals.revenueLastMonth)}
            />
            <Stat
              label="Documents processed this month"
              value={String(d.totals.billableOrdersThisMonth)}
            />
            <Stat label="Active clients" value={String(d.totals.activeClients)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by month</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revenue to date {formatEur(d.totals.revenueToDate)}. Invoice value processed:{" "}
                {formatEur(d.totals.orderValueToDate)} (supplier invoices, not AppBuilder.ai
                revenue).
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis
                    width={56}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatEur(v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">
                              {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatEur(Number(value))}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="subscription" stackId="rev" fill="var(--color-subscription)" />
                  <Bar dataKey="usage" stackId="rev" fill="var(--color-usage)" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Per month</TableHead>
                    <TableHead className="text-right">Per document</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="text-right">Documents this month</TableHead>
                    <TableHead className="text-right">Revenue this month</TableHead>
                    <TableHead className="text-right">Revenue to date</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {c.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{c.plan ?? "No plan"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {c.monthlyFee === null ? "—" : formatEur(c.monthlyFee)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {c.feePerOrder === null ? "—" : formatEur(c.feePerOrder)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(c.start)}</TableCell>
                      <TableCell className="text-right">{c.ordersThisMonth}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatEur(c.revenueThisMonth)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatEur(c.revenueToDate)}
                      </TableCell>
                      <TableCell>
                        {c.paymentStatus ? <StatusBadge status={c.paymentStatus} /> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
