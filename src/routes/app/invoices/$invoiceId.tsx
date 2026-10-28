import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AnomalyChips, approvalText } from "@/components/invoice-bits";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/format";
import { daysBetween, invoiceChecks, normIban } from "@/lib/invoice-rules";
import { askAssistant, decideInvoice, getInvoice } from "@/lib/invoices";
import type { InvoiceDetail, InvoiceLine, PoLine } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Invoice — AppBuilder.ai" }] }),
  component: InvoicePage,
});

type Decision = "approve" | "send_back" | "reject" | "duplicate";

const DECISION_TEXT: Record<Exclude<Decision, "approve">, { title: string; action: string }> = {
  send_back: { title: "Send back to supplier", action: "Send back" },
  duplicate: { title: "Mark as duplicate", action: "Mark duplicate" },
  reject: { title: "Reject invoice", action: "Reject" },
};

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

function findPoLine(line: InvoiceLine, poLines: PoLine[]) {
  return poLines.find(
    (p) =>
      (line.sku && p.sku === line.sku) ||
      (line.poLineRef && (p.sku === line.poLineRef || p.id === line.poLineRef || p.name === line.poLineRef)),
  );
}

const offCell = "bg-destructive/10 font-semibold text-destructive";

function MatchTable({ invoice }: { invoice: InvoiceDetail }) {
  const poLines = invoice.po?.lines ?? [];
  if (invoice.lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items on this invoice.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">PO qty</TableHead>
            <TableHead className="text-right">Delivered</TableHead>
            <TableHead className="text-right">Invoiced</TableHead>
            <TableHead className="text-right">PO price</TableHead>
            <TableHead className="text-right">Invoice price</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.lines.map((l) => {
            const po = findPoLine(l, poLines);
            const priceOff = l.lineCheck.includes("price_off");
            const qtyOff = l.lineCheck.includes("qty_off");
            return (
              <TableRow key={l.id}>
                <TableCell className="min-w-48">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.sku}</div>
                  {l.lineCheckNote && <div className="mt-1 text-xs text-muted-foreground">{l.lineCheckNote}</div>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{po ? po.quantity : "—"}</TableCell>
                <TableCell className={cn("text-right tabular-nums", qtyOff && offCell)}>
                  {po ? po.receivedQuantity : "—"}
                  {po?.deliveryNoteRef && (
                    <div className="text-xs font-normal text-muted-foreground">{po.deliveryNoteRef}</div>
                  )}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", qtyOff && offCell)}>{l.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{po ? formatMoney(po.price) : "—"}</TableCell>
                <TableCell className={cn("text-right tabular-nums", priceOff && offCell)}>
                  {formatMoney(l.price)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {l.lineCheck.length ? l.lineCheck.map((c) => <StatusBadge key={c} status={c} />) : "—"}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SupplierPanel({ invoice }: { invoice: InvoiceDetail }) {
  const s = invoice.supplier;
  if (!s) return <p className="text-sm text-muted-foreground">No supplier linked to this invoice.</p>;
  const differs = Boolean(invoice.ibanOnInvoice && s.iban && normIban(invoice.ibanOnInvoice) !== normIban(s.iban));
  const days = daysBetween(s.ibanChangedOn, invoice.invoiceDate);
  const expired =
    s.certificateValidUntil && invoice.invoiceDate
      ? new Date(s.certificateValidUntil) < new Date(invoice.invoiceDate)
      : false;
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted-foreground">Name</dt>
        <dd className="font-medium">{s.name}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Status</dt>
        <dd>{s.status ? <StatusBadge status={s.status} /> : "—"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">VAT ID</dt>
        <dd className="font-mono text-xs">{s.vatId ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Certificate valid until</dt>
        <dd className={cn(expired && "font-medium text-destructive")}>{formatDate(s.certificateValidUntil)}</dd>
      </div>
      <div className={cn("rounded-md border p-2", differs && "border-destructive/40 bg-destructive/10")}>
        <dt className="text-xs text-muted-foreground">IBAN on file</dt>
        <dd className="break-all font-mono text-xs">{s.iban ?? "—"}</dd>
      </div>
      <div className={cn("rounded-md border p-2", differs && "border-destructive/40 bg-destructive/10")}>
        <dt className="text-xs text-muted-foreground">IBAN on invoice</dt>
        <dd className={cn("break-all font-mono text-xs", differs && "font-semibold text-destructive")}>
          {invoice.ibanOnInvoice ?? "—"}
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs text-muted-foreground">IBAN changed on</dt>
        <dd>
          {formatDate(s.ibanChangedOn)}
          {days != null && days >= 0 && (
            <span className={cn("ml-1 text-xs", days <= 30 ? "text-warning" : "text-muted-foreground")}>
              ({days} days before invoice)
            </span>
          )}
          {s.previousIban && (
            <span className="block font-mono text-xs text-muted-foreground">Previously {s.previousIban}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function AssistantPanel({ dealId }: { dealId: string }) {
  const [sessionId] = useState(() => `inv-${dealId}-${Math.random().toString(36).slice(2, 10)}`);
  const [msgs, setMsgs] = useState<{ role: "user" | "worker"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const ask = useMutation({
    mutationFn: (message: string) => askAssistant({ data: { sessionId, message, dealId } }),
    onSuccess: (r) => setMsgs((m) => [...m, { role: "worker", text: r.reply }]),
    onError: (e) => setMsgs((m) => [...m, { role: "worker", text: (e as Error).message }]),
  });
  const send = (text: string) => {
    const t = text.trim();
    if (!t || ask.isPending) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    ask.mutate(t);
  };
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Ask the worker about this invoice.</p>
            {["Why is this in review?", "What should I ask the supplier?"].map((q) => (
              <Button key={q} variant="outline" size="sm" onClick={() => send(q)}>
                {q}
              </Button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap rounded-md p-2 text-sm",
              m.role === "user" ? "ml-6 bg-primary text-primary-foreground" : "mr-6 bg-muted",
            )}
          >
            {m.text}
          </div>
        ))}
        {ask.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" />
        <Button type="submit" size="icon" aria-label="Send" disabled={ask.isPending}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function InvoicePage() {
  const { invoiceId } = Route.useParams();
  const qc = useQueryClient();
  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoice({ data: { dealId: invoiceId } }),
  });
  const [approveOpen, setApproveOpen] = useState(false);
  const [dialog, setDialog] = useState<Exclude<Decision, "approve"> | null>(null);
  const [comment, setComment] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const decide = useMutation({
    mutationFn: (v: { decision: Decision; comment: string }) =>
      decideInvoice({ data: { dealId: invoiceId, ...v } }),
    onSuccess: async (_r, v) => {
      toast.success(
        v.decision === "approve"
          ? "Approved for payment."
          : v.decision === "send_back"
            ? "Sent back to the supplier."
            : v.decision === "duplicate"
              ? "Marked as duplicate."
              : "Invoice rejected.",
      );
      setApproveOpen(false);
      setDialog(null);
      setComment("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
        qc.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = invoice.data;
  const checks = useMemo(
    () =>
      d
        ? invoiceChecks({
            stageKey: d.stage,
            invoiceDate: d.invoiceDate,
            ibanOnInvoice: d.ibanOnInvoice,
            anomalyFlags: d.anomalyFlags,
            supplier: d.supplier,
            poFound: Boolean(d.po),
            lineChecks: d.lines.map((l) => l.lineCheck),
          })
        : [],
    [d],
  );

  const closed = d ? ["approved_for_payment", "rejected", "duplicate"].includes(d.stage) : true;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 pb-28 md:p-6 md:pb-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/invoices">
          <ArrowLeft /> Queue
        </Link>
      </Button>

      {invoice.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {invoice.error && <p className="text-sm text-destructive">{(invoice.error as Error).message}</p>}

      {d && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{d.supplierName ?? "Unknown supplier"}</h1>
                <StatusBadge status={d.stage} />
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{d.invoiceNumber ?? "No invoice number"}</span>
                {" · "}Dated {formatDate(d.invoiceDate)} · Due {formatDate(d.dueDate)}
                {d.poNumber ? ` · ${d.poNumber}` : ""}
              </p>
              <p className="text-sm font-medium">{approvalText(d.approvalLevel)}</p>
              {d.approvedBy && <p className="text-xs text-muted-foreground">Approved by {d.approvedBy}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">{formatMoney(d.amount)}</p>
              {d.vatAmount != null && (
                <p className="text-xs text-muted-foreground">incl. VAT {formatMoney(d.vatAmount)}</p>
              )}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setChatOpen(true)}>
                <MessageCircle /> Ask the worker
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why it's here</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.exceptionReason ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {sentences(d.exceptionReason).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No exceptions — all checks passed.</p>
              )}
              <AnomalyChips flags={d.anomalyFlags} />
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        c.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {c.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    </span>
                    <span className={cn(!c.passed && "font-medium")}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0">
              <CardTitle className="text-base">Three-way match</CardTitle>
              {d.matchResult && <StatusBadge status={d.matchResult} />}
              {d.po && (
                <span className="text-xs text-muted-foreground">
                  {d.po.poNumber} · {d.po.stageLabel}
                  {d.po.budgetCode ? ` · Budget ${d.po.budgetCode}` : ""}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {!d.po && <p className="mb-3 text-sm text-warning">No matching purchase order was found.</p>}
              <MatchTable invoice={d} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier</CardTitle>
              </CardHeader>
              <CardContent>
                <SupplierPanel invoice={d} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {d.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ol className="space-y-3 border-l pl-4">
                    {d.notes.map((n) => (
                      <li key={n.id} className="text-sm">
                        <p className="text-xs text-muted-foreground">{formatDate(n.timestamp)}</p>
                        {/* HubSpot note bodies may contain simple HTML; render them as text. */}
                        <div className="whitespace-pre-wrap break-words">
                          {n.body.replace(/<br\s*\/?>|<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "")}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
                <span className="font-semibold">Original document</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="border-t pt-4">
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
                    {d.rawText ?? "No original text stored."}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-3 md:static md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 md:flex md:flex-wrap">
              <Button
                className="col-span-2"
                disabled={d.stage !== "ready_to_approve" || decide.isPending}
                onClick={() => setApproveOpen(true)}
              >
                Approve for payment
              </Button>
              <Button variant="outline" disabled={closed || decide.isPending} onClick={() => setDialog("send_back")}>
                Send back
              </Button>
              <Button variant="outline" disabled={closed || decide.isPending} onClick={() => setDialog("duplicate")}>
                Mark duplicate
              </Button>
              <Button
                variant="outline"
                className="col-span-2 text-destructive md:col-span-1"
                disabled={closed || decide.isPending}
                onClick={() => setDialog("reject")}
              >
                Reject
              </Button>
            </div>
          </div>

          <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve {formatMoney(d.amount)} for payment?</AlertDialogTitle>
                <AlertDialogDescription>
                  {approvalText(d.approvalLevel)}. Confirm you are authorised at that level.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={decide.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    decide.mutate({ decision: "approve", comment: "" });
                  }}
                >
                  {decide.isPending && <Loader2 className="size-4 animate-spin" />}
                  Approve
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent>
              {dialog && (
                <>
                  <DialogHeader>
                    <DialogTitle>{DECISION_TEXT[dialog].title}</DialogTitle>
                    <DialogDescription>Add a comment — it's saved to the invoice's activity.</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explain your decision…"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialog(null)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!comment.trim() || decide.isPending}
                      onClick={() => decide.mutate({ decision: dialog, comment })}
                    >
                      {decide.isPending && <Loader2 className="size-4 animate-spin" />}
                      {DECISION_TEXT[dialog].action}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Sheet open={chatOpen} onOpenChange={setChatOpen}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Ask the worker</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1">
                <AssistantPanel dealId={invoiceId} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
