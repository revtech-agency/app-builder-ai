import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FileText, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AnomalyChips, approvalText } from "@/components/invoice-bits";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { splitList } from "@/lib/invoice-rules";
import { useAuth } from "@/lib/auth";
import { markDemoStep } from "@/lib/demo-guide";
import { submitDocument } from "@/lib/invoices";

export const Route = createFileRoute("/app/invoices/new")({
  head: () => ({ meta: [{ title: "Submit document — AppBuilder.ai" }] }),
  component: SubmitPage,
});

const SAMPLES = [
  {
    label: "Clean invoice",
    outcome: "All checks pass → Ready to approve",
    text: `Hello,

Please find our invoice below.

Invoice OS-2026-1251
Office Supplies Demo SRL · VAT RO10000001
Date 26.10.2026 · Due 25.11.2026 · Your PO: PO-2026-0444
PEN-BOX Ballpoint pens, box of 50  100 x 12.40 = 1,240.00
NOTE-PAD Sticky notes, pack of 12  200 x 3.10 = 620.00
Net 1,860.00 EUR · VAT 21% 390.60 · Total 2,250.60 EUR
Pay to IBAN RO12DEMO0000000000001001

Kind regards,
Ioana, Office Supplies Demo`,
  },
  {
    label: "Different IBAN",
    outcome: "Bank account differs from the one on file → Needs review",
    text: `Hello,

Invoice for the October follow-up days attached. Note our payment details below.

Invoice AP-2026-104
Advisory Partners Demo SRL · VAT RO10000005
Date 27.10.2026 · Due 26.11.2026 · PO-2026-0447
CONS-DAY Process consulting, senior consultant day  4 x 950.00 = 3,800.00
Net 3,800.00 · VAT 21% 798.00 · Total 4,598.00 EUR
IBAN RO21DEMO0000000000009999

Radu`,
  },
  {
    label: "Price and quantity off",
    outcome: "Price above the PO, more than delivered → Needs review",
    text: `Hi,

Invoice for the docking stations.

Invoice TN-55230
TechNova Hardware SRL · VAT RO10000002
Date 27.10.2026 · Due 26.11.2026 · PO-2026-0418
DOCK-USBC USB-C docking station  20 x 199.00 = 3,980.00
Net 3,980.00 · VAT 21% 835.80 · Total 4,815.80 EUR
IBAN RO34DEMO0000000000001002

Andrei, TechNova`,
  },
];

const MAX_PDF = 5 * 1024 * 1024;

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });
}

const PHASES = ["Reading document…", "Matching against the purchase order…", "Checking rules…"];

function SubmitPage() {
  const { isDemo } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [phase, setPhase] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // The sample now in the text box, if it hasn't been edited.
  const loaded = SAMPLES.findIndex((s) => s.text === text);

  // The demo account starts with a sample loaded, so visitors don't reach for their own invoice:
  // it can't match the demo suppliers and purchase orders.
  useEffect(() => {
    if (isDemo) setText((t) => t || (SAMPLES[0]?.text ?? ""));
  }, [isDemo]);

  const submit = useMutation({
    mutationFn: async () =>
      submitDocument({
        data: {
          ...(text.trim() ? { text } : {}),
          ...(file ? { pdfBase64: await toBase64(file), filename: file.name } : {}),
        },
      }),
    onSuccess: () => markDemoStep("submitted"),
  });

  useEffect(() => {
    if (!submit.isPending) return;
    setPhase(0);
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 4000);
    return () => clearInterval(t);
  }, [submit.isPending]);

  const r = submit.data;
  const flags = Array.isArray(r?.anomaly_flags) ? r.anomaly_flags : splitList(r?.anomaly_flags);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Submit document</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a supplier email or attach a PDF invoice. The worker reads it, runs the three-way
          match and files it.
        </p>
        {!isDemo && (
          <p className="mt-1 text-sm text-muted-foreground">
            Use a sample, or your own invoice: it's checked against the sample suppliers and
            purchase orders, so an invoice from a supplier or PO that isn't in the demo lands in
            Needs review.
          </p>
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-xs text-muted-foreground">
              Try a sample: each one fills in a supplier email that shows a different outcome. Then
              press Submit.
            </span>
            {SAMPLES.map((s, i) => (
              <Button
                key={s.label}
                type="button"
                variant={i === loaded ? "secondary" : "outline"}
                size="sm"
                aria-pressed={i === loaded}
                className="h-auto flex-col items-start gap-0.5 py-2 text-left"
                onClick={() => {
                  setText(s.text);
                  setFile(null);
                }}
              >
                <span className="flex items-center gap-1">
                  {i === loaded && <Check className="size-3.5" />}
                  {s.label}
                  {i === loaded && " — loaded"}
                </span>
                <span className="text-xs font-normal text-muted-foreground">{s.outcome}</span>
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-text">Document text</Label>
            <Textarea
              id="doc-text"
              rows={12}
              maxLength={20000}
              className="font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the invoice email here…"
            />
          </div>
          <div className="space-y-2">
            {isDemo && !showUpload && !file ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => setShowUpload(true)}
              >
                Use your own PDF instead (it lands in Needs review: it can't match the demo POs)
              </Button>
            ) : (
              <Label>Or a PDF (max 5 MB)</Label>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (f && f.size > MAX_PDF) {
                  setFileError("The PDF can be at most 5 MB.");
                  return;
                }
                setFileError(null);
                setFile(f);
                // A sample and a PDF would be read as one document.
                if (f && loaded >= 0) setText("");
              }}
            />
            {isDemo && !showUpload && !file ? null : file ? (
              <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove file"
                  onClick={() => setFile(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                Choose PDF
              </Button>
            )}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={submit.isPending || (!text.trim() && !file)}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && <Loader2 className="size-4 animate-spin" />}
            {submit.isPending ? PHASES[phase] : "Submit"}
          </Button>
          {submit.error && (
            <p className="text-sm text-destructive">{(submit.error as Error).message}</p>
          )}
        </CardContent>
      </Card>

      {r && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{r.supplier_name ?? "Document filed"}</CardTitle>
              {r.stage && <StatusBadge status={r.stage} />}
              {r.match_result && <StatusBadge status={r.match_result} />}
            </div>
            <p className="text-sm text-muted-foreground">
              {r.invoice_number ?? "No invoice number"}
              {r.amount != null ? ` · ${formatMoney(r.amount)}` : ""}
              {r.approval_level ? ` · ${approvalText(r.approval_level)}` : ""}
              {r.document_type ? ` · ${r.document_type.replace(/_/g, " ")}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnomalyChips flags={flags} />
            {r.exception_reason && (
              <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                {r.exception_reason}
              </p>
            )}
            {!!r.lines?.length && (
              <ul className="divide-y rounded-md border text-sm">
                {r.lines.map((l, i) => (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="font-medium">{l.name ?? l.sku}</div>
                      {l.line_check_note && (
                        <div className="text-xs text-muted-foreground">{l.line_check_note}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {splitList(l.line_check).map((c) => (
                        <StatusBadge key={c} status={c} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {r.supplier_email_draft && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Draft email to the supplier</p>
                <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 font-mono text-xs">
                  {r.supplier_email_draft}
                </pre>
              </div>
            )}
            {r.deal_id && (
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild>
                  <Link to="/app/invoices/$invoiceId" params={{ invoiceId: r.deal_id }}>
                    Open invoice
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">
                  See every check, ask the worker why, and make the decision.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
