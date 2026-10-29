import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Mail, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEMO_INVOICES } from "@/lib/demo-invoices";
import type { DemoInvoice } from "@/lib/demo-invoices";
import { formatMoney } from "@/lib/format";
import { DEMO_SEND_TO, INTAKE_MAILBOXES, POLL_MINUTES, sendDemoInvoice } from "@/lib/intake";
import { invoicePdf } from "@/lib/invoice-pdf";
import { listEmailIntake } from "@/lib/invoices";

export const Route = createFileRoute("/app/intake")({
  head: () => ({ meta: [{ title: "Email intake — AppBuilder.ai" }] }),
  component: IntakePage,
});

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

function downloadPdf(demo: DemoInvoice) {
  if (!demo.pdfText || !demo.filename) return;
  const blob = new Blob([invoicePdf(demo.pdfText)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = demo.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DemoCard({ demo }: { demo: DemoInvoice }) {
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => sendDemoInvoice({ data: { id: demo.id } }),
    onSuccess: () => {
      toast.success(`Sent to ${DEMO_SEND_TO}`, {
        description:
          "The worker reads the mailbox every minute. The invoice appears in the list above and the result email goes out a minute or two later.",
      });
      // Poll a little faster for the next few minutes so the new row shows up.
      setTimeout(() => void qc.invalidateQueries({ queryKey: ["email-intake"] }), 60_000);
      setTimeout(() => void qc.invalidateQueries({ queryKey: ["email-intake"] }), 120_000);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{demo.title}</CardTitle>
          <StatusBadge status={demo.expectedStage} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {demo.invoiceNumber ?? "No invoice number"}
          {demo.supplier ? ` · ${demo.supplier}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="flex-1 text-sm text-muted-foreground">{demo.description}</p>
        <p className="text-xs text-muted-foreground">
          {demo.pdfText
            ? "Email with the invoice as a PDF attachment"
            : "Plain email, no attachment"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
            <Send /> {send.isPending ? "Sending…" : "Send"}
          </Button>
          {demo.pdfText && (
            <Button size="sm" variant="outline" onClick={() => downloadPdf(demo)}>
              <Download /> PDF
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntakePage() {
  const navigate = useNavigate();
  const [showAllDemos, setShowAllDemos] = useState(false);
  const rows = useQuery({
    queryKey: ["email-intake"],
    queryFn: () => listEmailIntake(),
    refetchInterval: 30_000,
  });
  const demos = showAllDemos ? DEMO_INVOICES : DEMO_INVOICES.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Email intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI worker reads these mailboxes every{" "}
          {POLL_MINUTES === 1 ? "minute" : `${POLL_MINUTES} minutes`}. Each invoice is checked
          against the approval rules and added to the queue, and the recipient gets an email saying
          how it matched and what, if anything, needs doing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monitored mailboxes</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mailbox</TableHead>
                <TableHead>Picks up</TableHead>
                <TableHead>Result email to</TableHead>
                <TableHead>After reading</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INTAKE_MAILBOXES.map((m) => (
                <TableRow key={m.address}>
                  <TableCell className="whitespace-nowrap font-medium">
                    <Mail className="mr-2 inline size-4 text-muted-foreground" />
                    {m.address}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.picksUp}</TableCell>
                  <TableCell className="whitespace-nowrap">{m.notifies}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {m.marksRead ? "Marked read" : "Left unread"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Received by email</h2>
        {rows.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {rows.error && <p className="text-sm text-destructive">{(rows.error as Error).message}</p>}
        {rows.data && rows.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing received by email yet. Send a demo invoice below to try it.
            </CardContent>
          </Card>
        )}
        {rows.data && rows.data.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Result email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.data.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate({ to: "/app/invoices/$invoiceId", params: { invoiceId: r.id } })
                    }
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{r.emailFrom ?? "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      <Link
                        to="/app/invoices/$invoiceId"
                        params={{ invoiceId: r.id }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.emailSubject ?? r.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.supplierName ?? "Unknown supplier"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.stage} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {r.notifiedTo ? (
                        <>
                          {r.notifiedTo}
                          <br />
                          <span className="text-xs">{formatDateTime(r.notifiedAt)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Demo invoices</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fictional supplier invoices, each built to hit one rule. Send one to {DEMO_SEND_TO} and
            watch it arrive above; the badge shows the result the worker should reach. You can also
            download the PDF and email it from any mailbox.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <DemoCard key={d.id} demo={d} />
          ))}
        </div>
        {DEMO_INVOICES.length > 6 && (
          <Button variant="outline" onClick={() => setShowAllDemos((v) => !v)}>
            {showAllDemos ? "Show fewer" : `Show all ${DEMO_INVOICES.length}`}
          </Button>
        )}
      </div>
    </div>
  );
}
