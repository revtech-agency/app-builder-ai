import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

import { AnomalyChips, approvalShort } from "@/components/invoice-bits";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices, resetDemo } from "@/lib/invoices";
import type { InvoiceSummary } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/invoices/")({
  head: () => ({ meta: [{ title: "Invoice queue — AppBuilder.ai" }] }),
  component: QueuePage,
});

const TABS = [
  { key: "needs_review", label: "Needs review" },
  { key: "waiting_on_supplier", label: "Waiting on supplier" },
  { key: "ready_to_approve", label: "Ready to approve" },
  { key: "approved_for_payment", label: "Approved for payment" },
  { key: "duplicate", label: "Duplicate" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

const isOverdue = (i: InvoiceSummary) =>
  Boolean(i.dueDate) &&
  i.stage !== "approved_for_payment" &&
  new Date(i.dueDate as string).getTime() < new Date(new Date().toDateString()).getTime();

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function QueuePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>("needs_review");
  const [q, setQ] = useState("");
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => listInvoices() });
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: () => resetDemo(),
    onSuccess: async (r) => {
      toast.success("Demo reset", {
        description: `${r.archivedInvoices} added invoice(s) removed, ${r.restoredInvoices} sample invoice(s) restored.`,
      });
      await qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const all = invoices.data ?? [];

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const cleared = all.filter(
      (i) => i.stage === "ready_to_approve" || i.stage === "approved_for_payment",
    ).length;
    const exceptions = all.filter(
      (i) => i.stage === "needs_review" || i.stage === "waiting_on_supplier",
    );
    const waiting = all.filter((i) =>
      ["needs_review", "waiting_on_supplier", "ready_to_approve", "received"].includes(i.stage),
    );
    return {
      today: all.filter((i) => i.createdAt && new Date(i.createdAt).toDateString() === today)
        .length,
      cleared: all.length ? Math.round((cleared / all.length) * 100) : 0,
      exceptions: exceptions.length,
      waiting: waiting.reduce((s, i) => s + i.amount, 0),
    };
  }, [all]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const i of all) c[i.stage] = (c[i.stage] ?? 0) + 1;
    return c;
  }, [all]);

  const term = q.trim().toLowerCase();
  const rows = all.filter(
    (i) =>
      (tab === "all" || i.stage === tab) &&
      (!term ||
        [i.supplierName, i.invoiceNumber, i.poNumber].some((v) => v?.toLowerCase().includes(term))),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoice queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supplier invoices checked by the AI worker, waiting for your decision.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={reset.isPending}>
                <RotateCcw /> {reset.isPending ? "Resetting…" : "Reset demo"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes every invoice submitted during the demo and puts the six sample invoices
                  back as they started, so the sample emails work again. Suppliers and purchase
                  orders stay as they are.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => reset.mutate()}>Reset demo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button asChild>
            <Link to="/app/invoices/new">Submit document</Link>
          </Button>
        </div>
      </div>

      {invoices.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        invoices.data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Documents today" value={String(stats.today)} />
            <Stat label="Auto-cleared" value={`${stats.cleared}%`} />
            <Stat label="Exceptions open" value={String(stats.exceptions)} />
            <Stat label="Waiting" value={formatMoney(stats.waiting)} />
          </div>
        )
      )}

      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.label}
                  <span className="font-mono text-xs text-muted-foreground">
                    {counts[t.key] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supplier, invoice or PO no."
            className="pl-9"
            aria-label="Search invoices"
          />
        </div>
      </div>

      {invoices.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {invoices.error && (
        <p className="text-sm text-destructive">{(invoices.error as Error).message}</p>
      )}
      {invoices.data && rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {all.length === 0 ? "No invoices yet." : "Nothing here right now."}
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice no.</TableHead>
                <TableHead>Invoice date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Channel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow
                  key={i.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: "/app/invoices/$invoiceId", params: { invoiceId: i.id } })
                  }
                >
                  <TableCell className="font-medium">
                    <Link
                      to="/app/invoices/$invoiceId"
                      params={{ invoiceId: i.id }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {i.supplierName ?? "Unknown supplier"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{i.invoiceNumber ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(i.invoiceDate)}</TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap",
                      isOverdue(i) && "font-medium text-destructive",
                    )}
                  >
                    {formatDate(i.dueDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(i.amount)}</TableCell>
                  <TableCell>
                    {i.matchResult ? <StatusBadge status={i.matchResult} /> : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap capitalize">
                    {approvalShort(i.approvalLevel)}
                  </TableCell>
                  <TableCell className="min-w-48">
                    <AnomalyChips flags={i.anomalyFlags} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.channel ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
