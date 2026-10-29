// The demo invoices you can email to the monitored mailbox. They are the invoice worker's 12 test
// cases (n8n/invoice-worker/test-cases.json, 12 of 12 correct on 2026-10-29), so every one has a
// known expected result. Invoices go out as a PDF attachment with a short covering email; the
// supplier question goes out as a plain email, the way a supplier would write it.
import cases from "../../n8n/invoice-worker/test-cases.json";

import { INVOICE_STAGES } from "@/lib/invoice-rules";

type TestCase = {
  id: string;
  description: string;
  expected: { stage: string; match_result?: string; anomaly_flags?: string[] };
  request: { text: string };
};

export type DemoInvoice = {
  id: string;
  title: string;
  description: string;
  expectedStage: string;
  expectedStageLabel: string;
  expectedFlags: string[];
  supplier: string | null;
  invoiceNumber: string | null;
  // Email the demo sends: subject, covering text, and the PDF's text (null: no attachment).
  subject: string;
  body: string;
  pdfText: string | null;
  filename: string | null;
};

const field = (text: string, label: string) =>
  new RegExp(`^${label}:\\s*(.+)$`, "m").exec(text)?.[1]?.trim() ?? null;

const stageLabel = (key: string) =>
  Object.values(INVOICE_STAGES).find((s) => s.key === key)?.label ?? key;

const titleFromId = (id: string) => {
  const words = id.replace(/^\d+-/, "").replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function toDemo(c: TestCase): DemoInvoice {
  const text = c.request.text;
  const invoiceNumber = /^INVOICE\s+(\S+)/m.exec(text)?.[1] ?? null;
  const base = {
    id: c.id,
    title: titleFromId(c.id),
    description: c.description,
    expectedStage: c.expected.stage,
    expectedStageLabel: stageLabel(c.expected.stage),
    expectedFlags: c.expected.anomaly_flags ?? [],
  };
  if (invoiceNumber) {
    const supplier = field(text, "Supplier");
    const poField = field(text, "Purchase order");
    const po = poField && poField !== "(none)" ? poField : null;
    return {
      ...base,
      supplier,
      invoiceNumber,
      subject: `Invoice ${invoiceNumber}${supplier ? ` from ${supplier}` : ""}`,
      body:
        `Hello,\n\nPlease find attached our invoice ${invoiceNumber}` +
        `${po ? ` for purchase order ${po}` : ""}.\n\nKind regards,\n${supplier ?? "Accounts receivable"}`,
      pdfText: text,
      filename: `${c.id}.pdf`,
    };
  }
  // Not an invoice (a supplier question): the text is the email itself. The subject names the
  // invoice so the Gmail trigger, which only picks up invoice-like mail at daniel@tigros.io, sees it.
  const subjectLine = field(text, "Subject");
  const body = text.replace(/^Subject:.*\n+/m, "");
  const mentioned = /invoice\s+([A-Z]{2}-\d+)/i.exec(body)?.[1] ?? null;
  return {
    ...base,
    supplier: body.trim().split("\n").pop()?.trim() ?? null,
    invoiceNumber: mentioned,
    subject: `${subjectLine ?? "Question"}${mentioned ? ` for invoice ${mentioned}` : ""}`,
    body,
    pdfText: null,
    filename: null,
  };
}

export const DEMO_INVOICES: DemoInvoice[] = (cases as TestCase[]).map(toDemo);

export const demoInvoice = (id: string) => DEMO_INVOICES.find((d) => d.id === id) ?? null;
