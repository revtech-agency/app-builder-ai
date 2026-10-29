// Email intake: the mailboxes the n8n invoice worker watches, and the demo invoices the desk can
// email to them. The worker's own copy of the mailbox list is in the "Prepare Email" node of
// n8n/invoice-worker/1-process-supplier-invoices.json; keep the two in step.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireInvoiceDesk } from "@/lib/admin";
import { DEMO_INVOICES, demoInvoice } from "@/lib/demo-invoices";
import { buildUbl, parseInvoiceText, ublToText } from "@/lib/efactura";
import type { UblInvoice } from "@/lib/efactura";
import { bytesToBase64, invoicePdf } from "@/lib/invoice-pdf";
import { rateLimit } from "@/lib/rate-limit";
import type { SubmitResult } from "@/lib/invoices";

export type IntakeMailbox = {
  address: string;
  picksUp: string;
  notifies: string;
  marksRead: boolean;
};

export const INTAKE_MAILBOXES: IntakeMailbox[] = [
  {
    address: "daniel@tigros.io",
    picksUp:
      "Only the demo sends (mail from daniel@tigros.io itself) with a PDF attached, or with “invoice” or “factura” in the subject",
    notifies: "daniel@tigros.io",
    marksRead: false,
  },
  {
    address: "daniel@appbuilder.ai",
    picksUp:
      "Alias of daniel@tigros.io: only mail from daniel@tigros.io itself, with a PDF attached or “invoice” or “factura” in the subject",
    notifies: "daniel@tigros.io",
    marksRead: false,
  },
  {
    address: "demo@appbuilder.ai",
    picksUp:
      "Alias of daniel@tigros.io: only mail from daniel@tigros.io itself, with a PDF attached or “invoice” or “factura” in the subject",
    notifies: "daniel@tigros.io",
    marksRead: false,
  },
  {
    address: "demo+invoices@appbuilder.ai",
    picksUp: "Every unread email",
    notifies: "daniel@tigros.io",
    marksRead: true,
  },
];

// Demo invoices are sent here, so they go through the same Gmail trigger as a real supplier's.
export const DEMO_SEND_TO = "daniel@tigros.io";

export const POLL_MINUTES = 1;

// The demo invoices that are invoices (not the supplier question), as e-Factura XML.
export const EFACTURA_DEMOS = DEMO_INVOICES.filter((d) => d.pdfText).map((d) => ({
  ...d,
  ubl: parseInvoiceText(d.pdfText!)!,
}));

export const efacturaDemo = (id: string): UblInvoice | null =>
  EFACTURA_DEMOS.find((d) => d.id === id)?.ubl ?? null;

export const sendDemoInvoice = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk, rateLimit("sendDemoInvoice")])
  .inputValidator((input: { id: string }) =>
    z
      .object({ id: z.string().max(100) })
      .refine((d) => demoInvoice(d.id) !== null, "Unknown demo invoice.")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { n8n } = await import("@/lib/hubspot.server");
    const demo = demoInvoice(data.id)!;
    return n8n<{ sent?: boolean; message_id?: string; to?: string }>("invoice-demo-send", {
      demo_id: demo.id,
      to: DEMO_SEND_TO,
      subject: demo.subject,
      text: demo.body,
      sender_name: demo.supplier ?? "Demo supplier",
      filename: demo.filename,
      pdf_base64: demo.pdfText ? bytesToBase64(invoicePdf(demo.pdfText)) : null,
      requested_by: (context.claims as { email?: string }).email ?? "",
    });
  });

// ---------- RO e-Factura (simulated SPV) ----------

export type EfacturaResult = SubmitResult & { spv_id: string };

const MAX_XML = 500_000;

// Takes one invoice from the simulated SPV inbox (a demo invoice written as CIUS-RO XML) or an
// uploaded e-Factura XML, reads its fields from the XML and sends it through the invoice worker
// with the e-Factura channel. Same webhook as Submit document; the worker applies the same rules.
export const receiveEfactura = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk, rateLimit("receiveEfactura")])
  .inputValidator((input: { id?: string; xml?: string; filename?: string }) =>
    z
      .object({
        id: z.string().max(100).optional(),
        xml: z.string().max(MAX_XML, "The XML can be at most 500 KB.").optional(),
        filename: z.string().max(200).optional(),
      })
      .refine((d) => Boolean(d.id) !== Boolean(d.xml), "Pick a demo invoice or upload one XML.")
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EfacturaResult> => {
    let xml = data.xml ?? null;
    let filename = data.filename ?? "efactura.xml";
    if (data.id) {
      const inv = efacturaDemo(data.id);
      if (!inv) throw new Error("Unknown demo invoice.");
      xml = buildUbl(inv);
      filename = `${data.id}.xml`;
    }
    const text = xml ? ublToText(xml) : null;
    if (!text) throw new Error("This isn't a UBL e-Factura invoice (no <Invoice> element found).");
    const { n8n } = await import("@/lib/hubspot.server");
    // Stands in for the SPV download index ANAF gives each message.
    const spvId = String(Math.floor(1e9 + Math.random() * 9e9));
    const result = await n8n<SubmitResult>(
      "invoice-intake",
      {
        source_id: `efactura-${spvId}`,
        channel: "efactura",
        text,
        pdf_base64: null,
        filename,
        submitted_by: (context.claims as { email?: string }).email ?? "",
      },
      120_000,
    );
    return { ...result, spv_id: spvId };
  });
