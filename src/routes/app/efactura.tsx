import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, FileUp, Inbox, Landmark } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { RiskCell } from "@/components/invoice-bits";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { buildUbl } from "@/lib/efactura";
import { formatMoney } from "@/lib/format";
import { EFACTURA_DEMOS, receiveEfactura } from "@/lib/intake";
import type { EfacturaResult } from "@/lib/intake";
import { listEfacturaIntake } from "@/lib/invoices";

export const Route = createFileRoute("/app/efactura")({
  head: () => ({ meta: [{ title: "e-Factura intake — AppBuilder.ai" }] }),
  component: EfacturaPage,
});

type Demo = (typeof EFACTURA_DEMOS)[number];

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

function downloadXml(demo: Demo) {
  const blob = new Blob([buildUbl(demo.ubl)], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${demo.id}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CONNECTION = [
  ["Source", "ANAF SPV, RO e-Factura"],
  ["Status", "Simulated for the demo: the inbox below stands in for SPV"],
  ["Format", "UBL 2.1 XML, EN 16931 with CIUS-RO: fields are read from the XML, no PDF reading"],
  [
    "Live connection",
    "ANAF OAuth with the company's qualified certificate; n8n lists new SPV messages and downloads each XML",
  ],
  [
    "What the worker adds",
    "e-Factura proves the invoice was issued. It doesn't stop a duplicate, a changed IBAN, a price above the PO or goods not delivered: the 12 checks do",
  ],
] as const;

// Every receive goes through the worker and waits for its result (about 20–60 seconds).
function useReceive(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } | { xml: string; filename: string }) =>
      receiveEfactura({ data: input }),
    onSuccess: (r: EfacturaResult) => {
      toast.success(
        `${r.invoice_number ?? "Invoice"}: ${r.stage_label ?? r.stage ?? "processed"}`,
        {
          description: r.exception_reason || `Received from SPV as message ${r.spv_id}.`,
        },
      );
      onDone?.();
      void qc.invalidateQueries({ queryKey: ["efactura-intake"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      // HubSpot's search lags a few seconds behind the write.
      setTimeout(() => void qc.invalidateQueries({ queryKey: ["efactura-intake"] }), 5000);
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

function DemoCard({ demo }: { demo: Demo }) {
  const receive = useReceive();
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{demo.title}</CardTitle>
          <StatusBadge status={demo.expectedStage} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {demo.ubl.number} · {demo.ubl.supplier}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="flex-1 text-sm text-muted-foreground">{demo.description}</p>
        <p className="text-xs text-muted-foreground">
          {formatMoney(Number(demo.ubl.total) || 0)} · CIF {demo.ubl.vatId}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={receive.isPending}
            onClick={() => receive.mutate({ id: demo.id })}
          >
            <Inbox /> {receive.isPending ? "Checking…" : "Receive from SPV"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadXml(demo)}>
            <Download /> XML
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadXml() {
  const input = useRef<HTMLInputElement>(null);
  const receive = useReceive(() => {
    if (input.current) input.current.value = "";
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 500_000) {
            toast.error("The XML can be at most 500 KB.");
            return;
          }
          receive.mutate({ xml: await file.text(), filename: file.name });
        }}
      />
      <Button variant="outline" disabled={receive.isPending} onClick={() => input.current?.click()}>
        <FileUp /> {receive.isPending ? "Checking…" : "Upload an e-Factura XML"}
      </Button>
    </div>
  );
}

function EfacturaPage() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const rows = useQuery({
    queryKey: ["efactura-intake"],
    queryFn: () => listEfacturaIntake(),
    refetchInterval: 30_000,
  });
  const demos = showAll ? EFACTURA_DEMOS : EFACTURA_DEMOS.slice(0, 6);
  const held = (rows.data ?? []).reduce((s, r) => s + r.risk.amount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">e-Factura intake</h1>
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
              Simulated SPV
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Since 1 July 2024 Romanian B2B invoices go through RO e-Factura, and the buyer downloads
            them from ANAF's SPV as XML. The worker reads the fields straight from the XML and runs
            the same 12 checks as for an emailed invoice.
          </p>
        </div>
        <UploadXml />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-5" /> Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_1fr]">
            {CONNECTION.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Received through e-Factura</h2>
          {rows.data && rows.data.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Risky payments held:{" "}
              <span className="font-semibold text-foreground">{formatMoney(held)}</span>
            </p>
          )}
        </div>
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
              Nothing received through e-Factura yet. Take an invoice from the SPV inbox below.
            </CardContent>
          </Card>
        )}
        {rows.data && rows.data.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice no.</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>At risk</TableHead>
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
                    <TableCell>
                      <Link
                        to="/app/invoices/$invoiceId"
                        params={{ invoiceId: r.id }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.supplierName ?? "Unknown supplier"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.invoiceNumber ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.stage} />
                    </TableCell>
                    <TableCell>
                      <RiskCell risk={r.risk} />
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
          <h2 className="text-lg font-semibold">SPV inbox (simulated)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The demo invoices as e-Factura XML (simplified CIUS-RO, not checked with ANAF's
            validator). Receiving one runs it through the worker and waits for the result, about
            20–60 seconds; the badge shows the result it should reach. Download the XML to see what
            SPV delivers, or to upload it again.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((d) => (
            <DemoCard key={d.id} demo={d} />
          ))}
        </div>
        {EFACTURA_DEMOS.length > 6 && (
          <Button variant="outline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${EFACTURA_DEMOS.length}`}
          </Button>
        )}
      </div>
    </div>
  );
}
