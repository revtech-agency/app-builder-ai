import { describe, expect, it } from "vitest";

import invoiceWorker from "../../n8n/invoice-worker/1-process-supplier-invoices.json";
import demoSend from "../../n8n/invoice-worker/4-send-demo-invoice-email.json";
import { DEMO_INVOICES } from "@/lib/demo-invoices";
import { DEMO_SEND_TO, INTAKE_MAILBOXES } from "@/lib/intake";
import { invoicePdf } from "@/lib/invoice-pdf";
import { invoiceRisk } from "@/lib/money";

type Item = { json: Record<string, unknown>; binary?: Record<string, unknown> };

// Runs an n8n Code node's JavaScript with stubs for $input, $('Node').item and $('Node').all().
// A node that runs once per item returns one { json } object; n8n (and this helper) wrap it in a
// list.
function runCode(
  workflow: { nodes: { name: string; parameters: Record<string, unknown> }[] },
  name: string,
  input: Item[],
  refs: Record<string, Record<string, unknown>> = {},
  lists: Record<string, Record<string, unknown>[]> = {},
): Item[] {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`No node ${name}`);
  const $ = (ref: string) => ({
    item: { json: refs[ref] ?? {} },
    all: () => (lists[ref] ?? []).map((json) => ({ json })),
  });
  const $input = { all: () => input };
  const fn = new Function("$", "$input", "$json", node.parameters["jsCode"] as string);
  const out = fn($, $input, input[0]?.json ?? {}) as Item[] | Item;
  return Array.isArray(out) ? out : [out];
}

const email = (to: string, extra: Record<string, unknown> = {}): Item => ({
  json: {
    id: "abc123",
    from: { value: [{ address: "billing@supplier.example.com" }] },
    to: { value: [{ address: to }] },
    subject: "Invoice OS-1",
    text: "Please find attached our invoice.",
    ...extra,
  },
});

describe("demo invoices", () => {
  it("covers the 12 invoice worker test cases", () => {
    expect(DEMO_INVOICES).toHaveLength(12);
    expect(new Set(DEMO_INVOICES.map((d) => d.id)).size).toBe(12);
  });

  it("sends invoices as a PDF and the supplier question as plain text", () => {
    for (const d of DEMO_INVOICES) {
      if (d.id === "12-supplier-question") {
        expect(d.pdfText).toBeNull();
      } else {
        expect(d.pdfText).toMatch(/^INVOICE /);
        expect(d.filename).toBe(`${d.id}.pdf`);
      }
    }
  });

  it("gives every demo email a subject the daniel@tigros.io Gmail filter picks up", () => {
    for (const d of DEMO_INVOICES) expect(d.subject.toLowerCase()).toContain("invoice");
  });

  it("writes a well-formed PDF holding the invoice text", () => {
    const pdf = new TextDecoder("latin1").decode(invoicePdf(DEMO_INVOICES[0]!.pdfText!));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    // Every xref offset points at the start of its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    const entries = pdf
      .slice(xrefAt)
      .split("\n")
      .slice(3)
      .filter((l) => / n $/.test(l));
    entries.forEach((e, i) => expect(pdf.slice(Number(e.slice(0, 10)))).toMatch(`${i + 1} 0 obj`));
    expect(pdf).toContain("(Supplier: Office Supplies Demo SRL)");
  });

  it("escapes PDF string delimiters and spreads long text over pages", () => {
    const pdf = new TextDecoder("latin1").decode(
      invoicePdf(["A (b) c\\d", ...Array.from({ length: 80 }, (_, i) => `line ${i}`)].join("\n")),
    );
    expect(pdf).toContain("(A \\(b\\) c\\\\d)");
    expect(pdf).toContain("/Count 2");
  });
});

describe("n8n email intake", () => {
  it("knows the same mailboxes as the app, with the same recipient and read handling", () => {
    for (const m of INTAKE_MAILBOXES) {
      const [out] = runCode(invoiceWorker, "Prepare Email", [email(m.address)]);
      expect(out?.json).toMatchObject({
        received_by: m.address,
        notify_to: m.notifies,
        mark_read: m.marksRead,
        channel: "email",
        source_message_id: "gmail-abc123",
        submitted_by: "billing@supplier.example.com",
      });
    }
  });

  it("matches the mailbox on Cc and ignores letter case", () => {
    const [out] = runCode(invoiceWorker, "Prepare Email", [
      email("someone@else.example.com", { cc: { value: [{ address: "Daniel@Tigros.io" }] } }),
    ]);
    expect(out?.json["received_by"]).toBe("daniel@tigros.io");
  });

  it("never reads back the emails it sends itself", () => {
    const marker = "Sent by the AppBuilder.ai invoice worker";
    const out = runCode(invoiceWorker, "Prepare Email", [
      email("daniel@tigros.io", { text: `Result...\n${marker} for daniel@tigros.io.` }),
      email("daniel@tigros.io", { text: "", html: `<p>${marker}</p>` }),
      email("daniel@tigros.io"),
    ]);
    expect(out).toHaveLength(1);
    const trigger = invoiceWorker.nodes.find((n) => n.name === "Gmail Trigger")!;
    const q = (trigger.parameters as { filters: { q: string } }).filters.q;
    expect(q).toContain(`-"${marker}"`);
    expect(q).toContain("to:daniel@tigros.io");
    expect(q).toContain("to:demo+invoices@appbuilder.ai");
  });

  // In "run once for all items" mode $('Node').item is the first item only, so a node like that
  // turned two emails from one Gmail poll into one deal.
  it("handles every email of a Gmail poll, not just the first", () => {
    const code = invoiceWorker.nodes.filter((n) => n.type === "n8n-nodes-base.code");
    for (const n of code) {
      const js = (n.parameters as Record<string, unknown>)["jsCode"] as string;
      if (/\$\('[^']+'\)\.item\b/.test(js)) {
        expect((n.parameters as Record<string, unknown>)["mode"], n.name).toBe(
          "runOnceForEachItem",
        );
      }
    }
  });

  it("passes on the emails of one poll oldest first", () => {
    const out = runCode(invoiceWorker, "Prepare Email", [
      email("daniel@tigros.io", { id: "newer", date: "2026-10-29T08:07:19.000Z" }),
      email("daniel@tigros.io", { id: "older", date: "2026-10-29T08:07:14.000Z" }),
    ]);
    expect(out.map((o) => o.json["gmail_id"])).toEqual(["older", "newer"]);
  });

  it("marks a second copy of an invoice in the same Gmail poll as a duplicate", () => {
    const supplier = { id: "7", name: "Office Supplies Demo SRL", supplier_status: "approved" };
    const batch = ["gmail-a", "gmail-b"].map((id) => ({
      supplier,
      source_message_id: id,
      invoice_number: "OS-2026-1301",
    }));
    const stage = (sourceId: string) =>
      runCode(
        invoiceWorker,
        "Apply Rules",
        [],
        {
          "Read Document": {
            output: { document_type: "invoice", invoice_number: "OS-2026-1301", total_amount: 100 },
          },
          "Build Document Text": { source_message_id: sourceId, channel: "email" },
          "Match Supplier": { supplier },
          "Collect PO": { po: null, po_lines: [] },
          "Look Up History": { results: [] },
        },
        { "Match Supplier": batch },
      )[0]!.json["stage"];
    expect(stage("gmail-a")).not.toBe("duplicate");
    expect(stage("gmail-b")).toBe("duplicate");
  });

  it("only lets the demo sender mail a monitored mailbox", () => {
    const code = (
      demoSend.nodes.find((n) => n.name === "Prepare Demo Email")!.parameters as Record<
        string,
        unknown
      >
    )["jsCode"] as string;
    expect(code).toContain(`'${DEMO_SEND_TO}'`);
    for (const m of INTAKE_MAILBOXES) expect(code).toContain(`'${m.address}'`);
  });
});

describe("result email to the recipient", () => {
  const rules = (over: Record<string, unknown>) => ({
    stage: "ready_to_approve",
    stage_label: "Ready to approve",
    document_type: "invoice",
    invoice_number: "OS-2026-1301",
    supplier_name: "Office Supplies Demo SRL",
    amount: 2250.6,
    match_result: "full_match",
    approval_level: "team_lead",
    reply_to: "billing@supplier.example.com",
    received_by: "daniel@tigros.io",
    notify_to: "daniel@tigros.io",
    supplier_email_draft: "",
    deal_properties: { po_number: "PO-2026-0444" },
    line_items: [
      {
        name: "Pens",
        quantity: 100,
        price: 12.4,
        line_check: "matched",
        line_check_note: "Matches.",
      },
    ],
    checks: [
      { ok: true, name: "Supplier", detail: "Office Supplies Demo SRL is approved." },
      { ok: true, name: "IBAN", detail: "Matches the IBAN on file." },
    ],
    missing: [],
    ...over,
  });
  const build = (over: Record<string, unknown>) =>
    runCode(invoiceWorker, "Build Notification", [], {
      "Apply Rules": rules(over),
      "Create Invoice Deal": { id: "4711" },
    })[0]!.json as { notify_to: string; subject: string; html: string; deal_id: string };

  it("tells the recipient a clean invoice can be approved, and by whom", () => {
    const n = build({});
    expect(n.notify_to).toBe("daniel@tigros.io");
    expect(n.subject).toBe(
      "AppBuilder invoice check: Ready to approve · Invoice OS-2026-1301 · Office Supplies Demo SRL",
    );
    expect(n.html).toContain("Passed every check");
    expect(n.html).toContain("Approve it for payment in the app (needs a team lead approval)");
    expect(n.html).toContain("/app/invoices/4711");
    expect(n.html).toContain("Sent by the AppBuilder.ai invoice worker");
  });

  it("lists the failed checks when a person has to review it", () => {
    const n = build({
      stage: "needs_review",
      stage_label: "Needs review",
      checks: [
        {
          ok: false,
          name: "IBAN",
          detail:
            "IBAN on the invoice differs from the one on file. Verify by phone before paying.",
        },
      ],
    });
    expect(n.html).toContain("Needs a person to review it");
    expect(n.html).toContain("Verify by phone before paying.");
    expect(n.html).toContain("&#10007; IBAN");
  });

  it("says what is missing and that the supplier was already asked", () => {
    const n = build({
      stage: "waiting_on_supplier",
      stage_label: "Waiting on supplier",
      supplier_email_draft: "Dear supplier...",
      missing: ["a current tax-compliance certificate"],
    });
    expect(n.html).toContain("Missing: a current tax-compliance certificate.");
    expect(n.html).toContain("We emailed the supplier at billing@supplier.example.com");
  });

  it("warns not to pay a duplicate twice", () => {
    expect(build({ stage: "duplicate", stage_label: "Duplicate" }).html).toContain(
      "Do not pay it again",
    );
  });

  it("escapes what came from the email", () => {
    const n = build({ supplier_name: "<script>x</script>" });
    expect(n.html).not.toContain("<script>");
    expect(n.html).toContain("&lt;script&gt;");
  });
});

describe("money line in the result email", () => {
  const poLines = [
    { id: "901", price: "45.00", received_quantity: "12" },
    { id: "902", price: "10.00", received_quantity: "40" },
  ];
  const line = (o: Record<string, unknown>) => ({
    name: "Item",
    quantity: 10,
    price: 45,
    line_check: "matched",
    po_line_ref: "901",
    ...o,
  });
  const CASES: { name: string; rules: Record<string, unknown> }[] = [
    { name: "clean", rules: { line_items: [line({})], amount: 544.5 } },
    {
      name: "price above PO",
      rules: {
        stage: "needs_review",
        line_items: [line({ price: 48.9, line_check: "price_off" })],
        amount: 591.69,
      },
    },
    {
      name: "more than delivered",
      rules: {
        stage: "waiting_on_supplier",
        line_items: [line({ quantity: 15, line_check: "qty_off" })],
        amount: 816.75,
      },
    },
    {
      name: "price and quantity off, plus a line not on the PO",
      rules: {
        stage: "needs_review",
        line_items: [
          line({ quantity: 15, price: 50, line_check: "price_off;qty_off" }),
          line({ po_line_ref: "", quantity: 2, price: 30, line_check: "not_on_po" }),
        ],
        amount: 980.1,
      },
    },
    {
      name: "duplicate",
      rules: {
        stage: "duplicate",
        anomaly_flags: ["duplicate"],
        line_items: [line({})],
        amount: 544.5,
      },
    },
    {
      name: "IBAN changed",
      rules: {
        stage: "needs_review",
        anomaly_flags: ["iban_recently_changed"],
        line_items: [line({ price: 48.9, line_check: "price_off" })],
        amount: 591.69,
      },
    },
    {
      name: "split purchase",
      rules: {
        stage: "needs_review",
        anomaly_flags: ["split_purchase"],
        line_items: [line({})],
        amount: 2440.33,
      },
    },
    {
      name: "no PO",
      rules: {
        stage: "waiting_on_supplier",
        match_result: "no_po",
        line_items: [line({ po_line_ref: "", line_check: "not_on_po" })],
        amount: 1089,
      },
    },
    {
      name: "supplier question",
      rules: { document_type: "question", stage: "needs_review", line_items: [], amount: 0 },
    },
  ];

  for (const c of CASES) {
    it(`agrees with src/lib/money.ts: ${c.name}`, () => {
      const r = {
        stage: "ready_to_approve",
        stage_label: "Result",
        document_type: "invoice",
        match_result: "mismatch",
        anomaly_flags: [],
        checks: [],
        missing: [],
        notify_to: "daniel@tigros.io",
        ...c.rules,
      } as unknown as Record<string, unknown> & { line_items: Record<string, unknown>[] };
      const out = runCode(invoiceWorker, "Build Notification", [], {
        "Apply Rules": r,
        "Create Invoice Deal": { id: "1" },
        "Collect PO": { po_lines: poLines },
      })[0]!.json as { money_held: number; html: string };
      const expected = invoiceRisk({
        amount: r["amount"] as number,
        stage: r["stage"] as string,
        anomalyFlags: r["anomaly_flags"] as string[],
        matchResult: r["match_result"] as string,
        documentType: r["document_type"] as string,
        lines: r.line_items.map((l) => {
          const pl = poLines.find((p) => p.id === l["po_line_ref"]);
          return {
            quantity: l["quantity"] as number,
            price: l["price"] as number,
            lineCheck: String(l["line_check"]).split(";"),
            poPrice: pl ? Number(pl.price) : null,
            receivedQuantity: pl ? Number(pl.received_quantity) : null,
          };
        }),
      });
      expect(out.money_held).toBeCloseTo(expected.amount, 2);
      if (expected.amount > 0) expect(out.html).toContain("Money protected");
      else expect(out.html).not.toContain("Money protected");
    });
  }
});

describe("e-Factura through the app webhook", () => {
  // "Prepare App Request" awaits n8n's binary helper, so it runs as an async function.
  const prepare = async (body: Record<string, unknown>) => {
    const node = invoiceWorker.nodes.find((n) => n.name === "Prepare App Request")!;
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
      ...args: string[]
    ) => (json: unknown) => Promise<Item>;
    const fn = new AsyncFunction(
      "$json",
      (node.parameters as Record<string, unknown>)["jsCode"] as string,
    );
    return fn({ body });
  };

  it("keeps the e-Factura channel and source id the app sends", async () => {
    const out = await prepare({ source_id: "efactura-1234567890", channel: "efactura", text: "X" });
    expect(out.json).toMatchObject({
      channel: "efactura",
      source_message_id: "efactura-1234567890",
    });
  });

  it("treats anything else from the app as a manual submission", async () => {
    const out = await prepare({ source_id: "abc", channel: "email", text: "X" });
    expect(out.json).toMatchObject({ channel: "app", source_message_id: "app-abc" });
  });
});
