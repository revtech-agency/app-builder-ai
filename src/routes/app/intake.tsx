import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { FlagBadges } from "@/components/invoice/flag-badges";
import { LineTable } from "@/components/invoice/line-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatEur } from "@/lib/format";
import type { IntakeResult } from "@/lib/invoice-types";
import { submitInvoice } from "@/lib/invoices";

export const Route = createFileRoute("/app/intake")({
  head: () => ({ meta: [{ title: "Submit an invoice — AppBuilder.ai" }] }),
  component: IntakePage,
});

const MAX_PDF_BYTES = 5 * 1024 * 1024;

const SAMPLES = [
  {
    label: "Clean invoice",
    text: "Hello,\n\nPlease find our invoice below.\n\nInvoice OS-2026-1251\nOffice Supplies Demo SRL · VAT RO10000001\nDate 26.10.2026 · Due 25.11.2026 · Your PO: PO-2026-0444\nPEN-BOX Ballpoint pens, box of 50  100 x 12.40 = 1,240.00\nNOTE-PAD Sticky notes, pack of 12  200 x 3.10 = 620.00\nNet 1,860.00 EUR · VAT 21% 390.60 · Total 2,250.60 EUR\nPay to IBAN RO12DEMO0000000000001001\n\nKind regards,\nIoana, Office Supplies Demo",
  },
  {
    label: "Wrong price and quantity",
    text: "Hi,\n\nInvoice for the docking stations.\n\nInvoice TN-55230\nTechNova Hardware SRL · VAT RO10000002\nDate 27.10.2026 · Due 26.11.2026 · PO-2026-0418\nDOCK-USBC USB-C docking station  20 x 199.00 = 3,980.00\nNet 3,980.00 · VAT 21% 835.80 · Total 4,815.80 EUR\nIBAN RO34DEMO0000000000001002\n\nAndrei, TechNova",
  },
  {
    label: "Changed bank account",
    text: "Buna ziua,\n\nAtasat factura pentru curatenie octombrie. Va rugam sa folositi noul nostru cont bancar.\n\nFactura CP-1010\nCleanPro Facility Services SRL · CUI RO10000003\nData 27.10.2026 · Scadenta 26.11.2026 · Comanda PO-2026-0421\nCLN-OCT Curatenie sediu central, octombrie 2026  1 x 4,350.00\nTotal fara TVA 4,350.00 · TVA 21% 913.50 · Total 5,263.50 EUR\nIBAN RO56DEMO0000000000001903\n\nMaria, CleanPro",
  },
];

type Pdf = { name: string; base64: string };

function readPdf(file: File): Promise<Pdf> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve({ name: file.name, base64: result.slice(result.indexOf(",") + 1) });
    };
    reader.readAsDataURL(file);
  });
}

function IntakePage() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitInvoice({
        data: {
          ...(text.trim() ? { text: text.trim() } : {}),
          ...(pdf ? { pdfBase64: pdf.base64, filename: pdf.name } : {}),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Please choose a PDF file.");
    } else if (file.size > MAX_PDF_BYTES) {
      setFileError("That PDF is larger than 5 MB.");
    } else {
      try {
        setPdf(await readPdf(file));
      } catch (e) {
        setFileError((e as Error).message);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSubmit = Boolean(text.trim() || pdf) && !submit.isPending;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Submit an invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste the invoice or the supplier's email, or upload a PDF. The worker reads it, checks it
          against the purchase order and supplier records, and routes it.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label htmlFor="invoice-text" className="text-sm font-medium">
              Invoice or email text
            </label>
            <Textarea
              id="invoice-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder="Paste the invoice or email here…"
              maxLength={60000}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Try a sample</p>
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <Button
                  key={s.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setText(s.text)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">PDF (optional, max 5 MB)</p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              id="invoice-pdf"
              aria-label="Upload a PDF invoice"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {pdf ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
                <FileUp className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{pdf.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove PDF"
                  onClick={() => setPdf(null)}
                >
                  <X />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp /> Choose a PDF
              </Button>
            )}
            {fileError && (
              <p role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending && <Loader2 className="animate-spin" />}
              {submit.isPending ? "Processing…" : "Submit invoice"}
            </Button>
            {submit.isPending && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                This can take up to a minute while the invoice is read and checked.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {submit.error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {(submit.error as Error).message}
        </p>
      )}
      {submit.data && <ResultCard result={submit.data} />}
    </div>
  );
}

function ResultCard({ result }: { result: IntakeResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Result <StatusBadge status={result.stage} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.already_processed && (
          <p className="rounded-md border bg-muted p-3 text-sm">
            This invoice was already processed earlier, so nothing new was created.
          </p>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Supplier</dt>
            <dd className="text-sm font-medium">{result.supplier_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Invoice number</dt>
            <dd className="font-mono text-sm font-medium">{result.invoice_number || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Amount</dt>
            <dd className="text-sm font-medium tabular-nums">{formatEur(result.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Match result</dt>
            <dd className="text-sm font-medium">
              {result.match_result ? <StatusBadge status={result.match_result} /> : "—"}
            </dd>
          </div>
        </dl>

        {result.anomaly_flags.length > 0 && <FlagBadges flags={result.anomaly_flags} />}
        {result.exception_reason && (
          <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
            {result.exception_reason}
          </p>
        )}

        <LineTable
          lines={result.lines.map((l, i) => ({
            key: String(i),
            name: l.name,
            quantity: l.quantity,
            price: l.price,
            check: l.line_check,
            note: l.line_check_note || null,
          }))}
        />

        {result.supplier_email_draft && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Draft reply to the supplier</p>
            <blockquote className="whitespace-pre-wrap rounded-md border-l-4 border-primary bg-muted p-3 text-sm">
              {result.supplier_email_draft}
            </blockquote>
          </div>
        )}

        {result.deal_id && (
          <Button asChild>
            <Link to="/app/invoices/$invoiceId" params={{ invoiceId: result.deal_id }}>
              Open invoice
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
