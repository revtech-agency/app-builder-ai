/**
 * Writes the demo invoices to demo-invoices/: one PDF per invoice test case, the same invoices as
 * RO e-Factura XML in demo-invoices/efactura/, and README.md with the subject and text to send. The app's Email intake page builds the same PDFs on
 * the fly (src/lib/invoice-pdf.ts); these files are for sending from any mailbox by hand.
 *
 *   bun scripts/demo-invoices/generate.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { DEMO_INVOICES } from "../../src/lib/demo-invoices";
import { buildUbl, parseInvoiceText } from "../../src/lib/efactura";
import { invoicePdf } from "../../src/lib/invoice-pdf";
import { DEMO_SEND_TO } from "../../src/lib/intake";

const dir = new URL("../../demo-invoices/", import.meta.url);
mkdirSync(new URL("efactura/", dir), { recursive: true });

const md = [
  "# Demo invoices",
  "",
  `Send any of these to **${DEMO_SEND_TO}** (or demo+invoices@appbuilder.ai). The invoice worker in`,
  "n8n picks them up within a minute, checks them against the approval rules, adds them to the",
  "invoice queue and emails the result to the recipient. Or use **Email intake → Send** in the app.",
  "",
  "They are the 12 invoice worker test cases (`n8n/invoice-worker/test-cases.json`); the expected",
  "result is what the worker reached in the 12-of-12 test run. Regenerate with",
  "`bun scripts/demo-invoices/generate.ts`.",
  "",
  "The invoices are also in `efactura/` as RO e-Factura XML (UBL 2.1, simplified CIUS-RO, not checked",
  "with ANAF's validator). Upload one on **e-Factura intake** in the app, or take it from the",
  "simulated SPV inbox there; the worker reads the fields from the XML, no PDF reading.",
  "",
];
for (const d of DEMO_INVOICES) {
  if (d.pdfText && d.filename) {
    writeFileSync(new URL(d.filename, dir), invoicePdf(d.pdfText));
    writeFileSync(new URL(`efactura/${d.id}.xml`, dir), buildUbl(parseInvoiceText(d.pdfText)!));
  }
  md.push(
    `## ${d.title}`,
    "",
    `${d.description}`,
    "",
    `- Expected result: **${d.expectedStageLabel}**${d.expectedFlags.length ? ` (flags: ${d.expectedFlags.join(", ")})` : ""}`,
    `- Attachment: ${d.filename ? `[${d.filename}](${d.filename})` : "none, plain email"}`,
    ...(d.filename ? [`- e-Factura XML: [efactura/${d.id}.xml](efactura/${d.id}.xml)`] : []),
    `- Subject: \`${d.subject}\``,
    "",
    "```text",
    d.body,
    "```",
    "",
  );
}
writeFileSync(new URL("README.md", dir), md.join("\n"));
console.log(
  `Wrote ${DEMO_INVOICES.filter((d) => d.pdfText).length} PDFs and README.md to demo-invoices/`,
);
