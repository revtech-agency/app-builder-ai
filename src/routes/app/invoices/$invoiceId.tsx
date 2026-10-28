import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChatPanel } from "@/components/invoice/chat-panel";
import { FlagBadges } from "@/components/invoice/flag-badges";
import { LineTable } from "@/components/invoice/line-table";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatEur } from "@/lib/format";
import { APPROVAL_LABELS } from "@/lib/invoice-types";
import { decideInvoice, getInvoice } from "@/lib/invoices";

export const Route = createFileRoute("/app/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Invoice — AppBuilder.ai" }] }),
  component: InvoicePage,
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function InvoicePage() {
  const { invoiceId } = Route.useParams();
  const qc = useQueryClient();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoice({ data: { invoiceId } }),
  });

  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      decideInvoice({ data: { invoiceId, decision } }),
    onSuccess: (_res, decision) => {
      toast.success(decision === "approve" ? "Invoice approved for payment." : "Invoice rejected.");
      setPending(null);
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e) => {
      toast.error((e as Error).message || "Could not record the decision.");
      setPending(null);
    },
  });

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/app/invoices">
        <ArrowLeft /> All invoices
      </Link>
    </Button>
  );

  if (invoice.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (invoice.error || !invoice.data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        {back}
        <p className="text-sm text-destructive">
          {(invoice.error as Error | null)?.message ?? "Invoice not found."}
        </p>
      </div>
    );
  }

  const inv = invoice.data;
  const decided = inv.stage === "approved" || inv.stage === "rejected";
  const showException = Boolean(inv.exceptionReason) || inv.anomalyFlags.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold">{inv.ref}</h1>
            <StatusBadge status={inv.stage} />
          </div>
          <p className="text-sm text-muted-foreground">{inv.supplierName}</p>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{formatEur(inv.amount)}</p>
      </div>

      {showException && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm"
        >
          <p className="flex items-center gap-2 font-semibold text-warning">
            <TriangleAlert className="size-4" aria-hidden /> Needs attention
          </p>
          {inv.exceptionReason && <p>{inv.exceptionReason}</p>}
          <FlagBadges flags={inv.anomalyFlags} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key facts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Invoice date">{formatDate(inv.invoiceDate)}</Fact>
            <Fact label="Due date">{formatDate(inv.dueDate)}</Fact>
            <Fact label="PO number">{inv.poNumber ?? "—"}</Fact>
            <Fact label="IBAN on invoice">
              <span className="font-mono">{inv.ibanOnInvoice ?? "—"}</span>
            </Fact>
            <Fact label="VAT">{inv.vatAmount != null ? formatEur(inv.vatAmount) : "—"}</Fact>
            <Fact label="Approval level">
              {inv.approvalLevel ? APPROVAL_LABELS[inv.approvalLevel] : "—"}
            </Fact>
            <Fact label="Match result">
              {inv.matchResult ? <StatusBadge status={inv.matchResult} /> : "—"}
            </Fact>
            <Fact label="Extraction confidence">
              {inv.minFieldConfidence != null
                ? `${Math.round(inv.minFieldConfidence * 100)}% (lowest field)`
                : "—"}
            </Fact>
            {inv.approvedBy && <Fact label="Decided by">{inv.approvedBy}</Fact>}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <LineTable
            lines={inv.lines.map((l) => ({
              key: l.id,
              name: l.name,
              sku: l.sku,
              quantity: l.quantity,
              price: l.price,
              check: l.check,
              note: l.checkNote,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checks</CardTitle>
        </CardHeader>
        <CardContent>
          {inv.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit checks recorded.</p>
          ) : (
            <ul className="space-y-2">
              {inv.audit.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Passed" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />
                  )}
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.detail && <span className="text-muted-foreground"> — {c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!decided && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!inv.canDecide || decide.isPending}
                onClick={() => setPending("approve")}
              >
                <Check /> Approve
              </Button>
              <Button
                variant="outline"
                disabled={!inv.canDecide || decide.isPending}
                onClick={() => setPending("reject")}
              >
                <X /> Reject
              </Button>
            </div>
            {!inv.canDecide && inv.cannotDecideReason && (
              <p className="text-sm text-muted-foreground">{inv.cannotDecideReason}</p>
            )}
          </CardContent>
        </Card>
      )}

      <ChatPanel invoiceId={invoiceId} />

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "approve" ? "Approve this invoice?" : "Reject this invoice?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "approve"
                ? `Invoice ${inv.ref} from ${inv.supplierName} (${formatEur(inv.amount)}) will be approved for payment.`
                : `Invoice ${inv.ref} from ${inv.supplierName} (${formatEur(inv.amount)}) will be rejected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={decide.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) decide.mutate(pending);
              }}
            >
              {decide.isPending ? "Saving…" : pending === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
