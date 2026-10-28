import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { FlagBadges } from "@/components/invoice/flag-badges";
import { StatusBadge } from "@/components/status-badge";
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
import { formatDate, formatEur } from "@/lib/format";
import { APPROVAL_LABELS, INVOICE_STAGES } from "@/lib/invoice-types";
import type { InvoiceStageKey } from "@/lib/invoice-types";
import { listInvoices } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — AppBuilder.ai" }] }),
  component: InvoicesPage,
});

const STAGES = Object.values(INVOICE_STAGES);
const PROMINENT: InvoiceStageKey[] = ["needs_review", "waiting_on_supplier"];

function InvoicesPage() {
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => listInvoices() });
  const [stage, setStage] = useState<InvoiceStageKey | "all">("all");
  const [search, setSearch] = useState("");

  const data = invoices.data;
  const counts = useMemo(() => {
    const c: Partial<Record<InvoiceStageKey, number>> = {};
    for (const i of data ?? []) c[i.stage] = (c[i.stage] ?? 0) + 1;
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((i) => stage === "all" || i.stage === stage)
      .filter(
        (i) => !q || i.supplierName.toLowerCase().includes(q) || i.ref.toLowerCase().includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data, stage, search]);

  const total = data?.length ?? 0;
  const needReview = counts.needs_review ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {data
              ? `${total} invoice${total === 1 ? "" : "s"} · ${needReview} need review`
              : "Supplier invoices and where each one stands."}
          </p>
        </div>
        <Button asChild>
          <Link to="/app/intake">Submit an invoice</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by stage">
        <Button
          size="sm"
          variant={stage === "all" ? "default" : "outline"}
          aria-pressed={stage === "all"}
          onClick={() => setStage("all")}
        >
          All ({total})
        </Button>
        {STAGES.map((s) => {
          const prominent = PROMINENT.includes(s.key);
          const active = stage === s.key;
          return (
            <Button
              key={s.key}
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => setStage(s.key)}
              className={cn(
                !active &&
                  prominent &&
                  "border-primary bg-accent font-semibold text-accent-foreground",
              )}
            >
              {s.label} ({counts[s.key] ?? 0})
            </Button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier or invoice number"
          aria-label="Search supplier or invoice number"
          className="pl-8"
        />
      </div>

      {invoices.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {invoices.error && (
        <p className="text-sm text-destructive">{(invoices.error as Error).message}</p>
      )}
      {data && rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {total === 0 ? "No invoices yet." : "No invoices match your filters."}
          </CardContent>
        </Card>
      )}
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link
                        to="/app/invoices/$invoiceId"
                        params={{ invoiceId: i.id }}
                        className="font-mono text-sm font-semibold underline-offset-4 hover:underline"
                      >
                        {i.ref}
                      </Link>
                    </TableCell>
                    <TableCell>{i.supplierName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEur(i.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={i.stage} />
                    </TableCell>
                    <TableCell className="min-w-40 whitespace-normal">
                      <FlagBadges flags={i.anomalyFlags} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(i.dueDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.approvalLevel ? APPROVAL_LABELS[i.approvalLevel].split(" (")[0] : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
