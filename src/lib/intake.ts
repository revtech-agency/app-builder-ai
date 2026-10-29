// Email intake: the mailboxes the n8n invoice worker watches, and the demo invoices the desk can
// email to them. The worker's own copy of the mailbox list is in the "Prepare Email" node of
// n8n/invoice-worker/1-process-supplier-invoices.json; keep the two in step.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireInvoiceDesk } from "@/lib/admin";
import { demoInvoice } from "@/lib/demo-invoices";
import { bytesToBase64, invoicePdf } from "@/lib/invoice-pdf";

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

export const sendDemoInvoice = createServerFn({ method: "POST" })
  .middleware([requireInvoiceDesk])
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
