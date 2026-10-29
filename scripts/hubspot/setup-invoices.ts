/**
 * HubSpot setup for the AppBuilder.ai invoice-worker demo (banking: supplier invoices,
 * three-way match of purchase order, delivery note and invoice).
 *
 * Creates (or reuses) the "AppBuilder.ai invoice worker" properties and the "Procure-to-pay"
 * deal pipeline (the converted default pipeline), then loads six demo suppliers, ten purchase orders
 * and six already-processed invoices (the history the live run checks against). The other
 * documents go to data/invoices/live-messages.json, to send during the live run.
 * Nothing from the casings order worker (setup.ts) is changed.
 *
 *   bun scripts/hubspot/setup-invoices.ts             # writes to the portal
 *   bun scripts/hubspot/setup-invoices.ts --dry-run   # reads only, prints what it would do
 *   bun scripts/hubspot/setup-invoices.ts --properties-only   # only adds missing properties
 *
 * Needs HUBSPOT_ACCESS_TOKEN (a private app token, the one the app uses) in .env.local, which git
 * ignores and bun loads on its own. HUBSPOT_API_KEY still works as the old name.
 */
import data from "./data/invoices/invoices.json";

const TOKEN = process.env.HUBSPOT_ACCESS_TOKEN ?? process.env.HUBSPOT_API_KEY;
const DRY = process.argv.includes("--dry-run");
const PROPERTIES_ONLY = process.argv.includes("--properties-only");
const BASE = "https://api.hubapi.com";
const GROUP = "appbuilder_invoice_worker";
const VAT = 0.21;
const PRICE_TOLERANCE = 0.02;

if (!TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN is missing: copy .env.example to .env.local and add the token");

type Doc = (typeof data.documents)[number];
type DocLine = { sku: string | null; name: string; quantity: number; price: number };
type Pipeline = { id: string; stages: Record<string, string> };

async function hs(method: string, path: string, body?: unknown): Promise<any> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) {
      await Bun.sleep(1000 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.message ?? text}`);
    return data;
  }
  throw new Error(`${method} ${path} -> still rate-limited after 5 tries`);
}

// Writes go through here so --dry-run never changes the portal.
async function write(label: string, method: string, path: string, body?: unknown): Promise<any> {
  if (DRY) {
    console.log(`  [dry-run] ${label}`);
    return { id: `dry-${label}`, results: [] };
  }
  return hs(method, path, body);
}

// ---------- properties ----------

type Prop = { name: string; label: string; type: string; fieldType: string; description: string; options?: string[] };

const opts = (values: string[]) => values.map((v, i) => ({ label: v, value: v, displayOrder: i }));

const PROPERTIES: Record<string, Prop[]> = {
  companies: [
    { name: "supplier_status", label: "Supplier status", type: "enumeration", fieldType: "select",
      options: ["approved", "pending_onboarding", "blocked"],
      description: "Whether the bank may pay this supplier. Only approved suppliers' invoices can be cleared; the others go to review. Having this field set is what marks a company as a supplier." },
    { name: "supplier_vat_id", label: "Supplier VAT ID", type: "string", fieldType: "text",
      description: "The supplier's VAT / tax ID (CUI), as printed on its invoices. The invoice worker uses it first to recognise who sent an invoice." },
    { name: "supplier_iban", label: "Supplier IBAN", type: "string", fieldType: "text",
      description: "The bank account on file for paying this supplier. An invoice asking for payment to a different account is held for review." },
    { name: "previous_iban", label: "Previous IBAN", type: "string", fieldType: "text",
      description: "The supplier's bank account before the last change, kept so reviewers can see what changed." },
    { name: "iban_changed_on", label: "IBAN changed on", type: "date", fieldType: "date",
      description: "When the supplier's bank account was last changed. Invoices within 30 days of a change are held until the change is confirmed by phone." },
    { name: "tax_certificate_valid_until", label: "Tax certificate valid until", type: "date", fieldType: "date",
      description: "Expiry of the supplier's tax-compliance certificate. If it is expired or missing, the invoice waits until the supplier sends a current one." },
  ],
  deals: [
    { name: "po_number", label: "PO number", type: "string", fieldType: "text",
      description: "The purchase order number. On a purchase order it is the PO's own number; on an invoice it is the PO the supplier quoted, used to match the two." },
    { name: "budget_code", label: "Budget code", type: "string", fieldType: "text",
      description: "The internal budget the purchase order is charged to." },
    { name: "po_requester", label: "PO requester", type: "string", fieldType: "text",
      description: "The department that asked for the purchase." },
    { name: "document_type", label: "Document type", type: "enumeration", fieldType: "select",
      options: ["purchase_order", "invoice", "credit_note", "reminder", "question", "other"],
      description: "What the record is: a purchase order the bank issued, or the kind of incoming supplier document, as sorted by the invoice worker." },
    { name: "invoice_number", label: "Invoice number", type: "string", fieldType: "text",
      description: "The supplier's own invoice number. Together with the supplier it is used to catch the same invoice sent twice." },
    { name: "invoice_date", label: "Invoice date", type: "date", fieldType: "date",
      description: "The date printed on the invoice." },
    { name: "due_date", label: "Due date", type: "date", fieldType: "date",
      description: "When the invoice must be paid." },
    { name: "iban_on_invoice", label: "IBAN on invoice", type: "string", fieldType: "text",
      description: "The bank account the invoice asks to be paid to. Compared with the supplier's IBAN on file." },
    { name: "vat_amount", label: "VAT amount", type: "number", fieldType: "number",
      description: "The VAT on the invoice, in euros. The deal amount is the invoice total including VAT." },
    { name: "match_result", label: "Match result", type: "enumeration", fieldType: "select",
      options: ["full_match", "within_tolerance", "mismatch", "no_po"],
      description: "How the invoice compares with its purchase order and delivery notes: an exact match, small price differences within 2%, a mismatch, or no purchase order found." },
    { name: "approval_level", label: "Approval level", type: "enumeration", fieldType: "select",
      options: ["team_lead", "head_of_department", "cfo"],
      description: "Who must approve the payment, from the invoice total: up to 5,000 EUR a team lead, up to 25,000 EUR a head of department, above that the CFO." },
    { name: "anomaly_flags", label: "Anomaly flags", type: "enumeration", fieldType: "checkbox",
      options: ["duplicate", "iban_mismatch", "iban_recently_changed", "split_purchase", "unknown_supplier",
        "supplier_blocked", "certificate_expired", "low_confidence"],
      description: "Warning signs the invoice worker found, such as a changed bank account or an invoice split to stay under an approval limit. Any flag sends the invoice to a person." },
    { name: "approved_by", label: "Approved by", type: "string", fieldType: "text",
      description: "Email of the person who approved the invoice for payment in the app." },
    { name: "email_from", label: "Email from", type: "string", fieldType: "text",
      description: "For an invoice that came in by email: the address it was sent from." },
    { name: "email_subject", label: "Email subject", type: "string", fieldType: "text",
      description: "For an invoice that came in by email: the subject of that email." },
    { name: "email_received_by", label: "Received by mailbox", type: "string", fieldType: "text",
      description: "For an invoice that came in by email: which monitored mailbox it was sent to." },
    { name: "notified_to", label: "Notification sent to", type: "string", fieldType: "text",
      description: "Who the invoice worker emailed with the result of the checks and what to do next." },
    { name: "notified_at", label: "Notification sent at", type: "datetime", fieldType: "date",
      description: "When the invoice worker sent that email." },
  ],
  line_items: [
    { name: "received_quantity", label: "Received quantity", type: "number", fieldType: "number",
      description: "On a purchase order line: how much has been delivered so far, from the delivery notes. An invoice can't charge for more than this." },
    { name: "delivery_note_ref", label: "Delivery note", type: "string", fieldType: "text",
      description: "On a purchase order line: the delivery note (or service sheet) that confirms what was received." },
    { name: "po_line_ref", label: "Matched PO line", type: "string", fieldType: "text",
      description: "On an invoice line: the purchase order line it was matched to." },
    { name: "line_check", label: "Line check", type: "enumeration", fieldType: "checkbox",
      options: ["matched", "price_off", "qty_off", "not_on_po"],
      description: "On an invoice line: whether it matches the purchase order and delivery note, or every problem found (price over tolerance, more than delivered, not on the PO). A line can have more than one problem." },
    { name: "line_check_note", label: "Line check note", type: "string", fieldType: "text",
      description: "On an invoice line: the difference in plain words, e.g. invoiced price vs PO price." },
  ],
};

async function ensureProperties() {
  for (const [object, props] of Object.entries(PROPERTIES)) {
    const groups = await hs("GET", `/crm/v3/properties/${object}/groups`);
    if (!groups.results.some((g: any) => g.name === GROUP)) {
      await write(`group ${object}.${GROUP}`, "POST", `/crm/v3/properties/${object}/groups`, {
        name: GROUP, label: "AppBuilder.ai invoice worker", displayOrder: -1,
      });
    }
    const existing = new Set((await hs("GET", `/crm/v3/properties/${object}`)).results.map((p: any) => p.name));
    for (const p of props) {
      if (existing.has(p.name)) {
        console.log(`  ${object}.${p.name} exists, kept as is`);
        continue;
      }
      await write(`property ${object}.${p.name}`, "POST", `/crm/v3/properties/${object}`, {
        name: p.name, label: p.label, type: p.type, fieldType: p.fieldType, groupName: GROUP,
        description: p.description, ...(p.options ? { options: opts(p.options) } : {}),
      });
      console.log(`  created ${object}.${p.name}`);
    }
  }
}

// Options the invoice worker writes on properties that setup.ts (the order worker) created:
// order_channel gets "efactura" for invoices received through RO e-Factura (SPV).
const EXTRA_OPTIONS: { object: string; name: string; values: string[] }[] = [
  { object: "deals", name: "order_channel", values: ["efactura"] },
];

type PropOption = { label: string; value: string; displayOrder?: number };

async function ensureOptions() {
  for (const e of EXTRA_OPTIONS) {
    const path = `/crm/v3/properties/${e.object}/${e.name}`;
    const current: PropOption[] = (await hs("GET", path)).options ?? [];
    const have = new Set(current.map((o) => o.value));
    const missing = e.values.filter((v) => !have.has(v));
    if (missing.length === 0) {
      console.log(`  ${e.object}.${e.name} options ok`);
      continue;
    }
    const added = missing.map((value, i) => ({
      label: value === "efactura" ? "e-Factura" : value,
      value,
      displayOrder: current.length + i,
    }));
    await write(`options ${e.object}.${e.name} += ${missing.join(", ")}`, "PATCH", path, {
      options: [...current, ...added],
    });
    console.log(`  added ${missing.join(", ")} to ${e.object}.${e.name}`);
  }
}

// ---------- pipeline ----------

// The portal allows one custom deal pipeline (Orders uses it), so purchase orders and invoices
// share the default pipeline, renamed "Procure-to-pay". They are told apart by stage
// (the "PO …" stages) and by document_type ("purchase_order" vs invoice types).
type Stage = { label: string; probability: string; closed?: boolean };

const P2P_LABEL = "Procure-to-pay";
const P2P_STAGES: Stage[] = [
  { label: "PO open", probability: "0.2" },
  { label: "PO partly received", probability: "0.5" },
  { label: "PO fully received", probability: "0.8" },
  { label: "PO closed", probability: "1.0", closed: true },
  { label: "Received", probability: "0.1" },
  { label: "Waiting on supplier", probability: "0.3" },
  { label: "Needs review", probability: "0.3" },
  { label: "Ready to approve", probability: "0.8" },
  { label: "Approved for payment", probability: "1.0", closed: true },
  { label: "Duplicate", probability: "0.0", closed: true },
  { label: "Rejected", probability: "0.0", closed: true },
];

async function ensurePipeline(): Promise<Pipeline> {
  const all = (await hs("GET", "/crm/v3/pipelines/deals")).results;
  let pipeline = all.find((p: any) => p.label === P2P_LABEL);
  if (!pipeline) {
    // Convert the default pipeline, but only while it holds no deals. Its old stages are
    // replaced (not relabelled), so anything still writing an old stage ID fails loudly.
    const used = await hs("POST", "/crm/v3/objects/deals/search", {
      filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: "default" }] }], limit: 1,
    });
    if (used.total > 0) throw new Error(`The default pipeline has ${used.total} deal(s); not converting it to ${P2P_LABEL}.`);
    pipeline = await write(`convert default pipeline to ${P2P_LABEL}`, "PUT", "/crm/v3/pipelines/deals/default", {
      label: P2P_LABEL,
      displayOrder: 0,
      stages: P2P_STAGES.map((s, i) => ({
        label: s.label, displayOrder: i,
        metadata: { probability: s.probability, isClosed: s.closed ? "true" : "false" },
      })),
    });
    console.log(`  converted the default pipeline to ${P2P_LABEL}`);
  } else {
    console.log(`  pipeline ${P2P_LABEL} exists, kept as is`);
  }
  const stages: Record<string, string> = {};
  for (const s of pipeline.stages ?? []) stages[s.label] = s.id;
  return { id: pipeline.id, stages };
}

// ---------- records and associations ----------

async function findOne(object: string, property: string, value: string): Promise<string | undefined> {
  const res = await hs("POST", `/crm/v3/objects/${object}/search`, {
    filterGroups: [{ filters: [{ propertyName: property, operator: "EQ", value }] }],
    limit: 1,
  });
  return res.results[0]?.id;
}

async function associate(from: string, fromId: string, to: string, toId: string) {
  await write(`associate ${from} ${fromId} -> ${to} ${toId}`, "PUT",
    `/crm/v4/objects/${from}/${fromId}/associations/default/${to}/${toId}`);
}

async function upsertSuppliers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const s of data.suppliers) {
    const props = {
      name: s.name, domain: s.domain, city: s.city, country: "Romania",
      supplier_status: s.supplier_status, supplier_vat_id: s.supplier_vat_id, supplier_iban: s.supplier_iban,
      previous_iban: s.previous_iban, iban_changed_on: s.iban_changed_on,
      tax_certificate_valid_until: s.tax_certificate_valid_until,
    };
    let companyId = await findOne("companies", "domain", s.domain);
    if (companyId) await write(`update supplier ${s.name}`, "PATCH", `/crm/v3/objects/companies/${companyId}`, { properties: props });
    else companyId = (await write(`create supplier ${s.name}`, "POST", "/crm/v3/objects/companies", { properties: props })).id;

    let contactId = await findOne("contacts", "email", s.contact.email);
    if (!contactId) {
      contactId = (await write(`create contact ${s.contact.email}`, "POST", "/crm/v3/objects/contacts", { properties: s.contact })).id;
      await associate("contacts", contactId!, "companies", companyId!);
    }
    ids.set(s.key, companyId!);
    console.log(`  supplier ${s.name} ready`);
  }
  return ids;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// PO number -> its line items (id + figures), for matching the history invoices.
type PoLine = { id: string; sku: string; quantity: number; price: number; received: number; deliveryNote: string };

async function loadPurchaseOrders(pipeline: Pipeline, suppliers: Map<string, string>): Promise<Map<string, PoLine[]>> {
  const out = new Map<string, PoLine[]>();
  for (const po of data.purchase_orders) {
    const supplier = data.suppliers.find((s) => s.key === po.supplier)!;
    const existing = DRY ? undefined : await findOne("deals", "po_number", po.po_number);
    if (existing) {
      // Read its lines back so the invoices can reference them.
      const assoc = await hs("GET", `/crm/v4/objects/deals/${existing}/associations/line_items`);
      const lineIds: string[] = assoc.results.map((r: any) => String(r.toObjectId));
      const lines = lineIds.length
        ? (await hs("POST", "/crm/v3/objects/line_items/batch/read", {
            properties: ["hs_sku"], inputs: lineIds.map((id) => ({ id })),
          })).results
        : [];
      out.set(po.po_number, po.lines.map((l) => ({
        id: lines.find((x: any) => x.properties.hs_sku === l.sku)?.id ?? "",
        sku: l.sku, quantity: l.quantity, price: l.price, received: l.received_quantity, deliveryNote: l.delivery_note_ref,
      })));
      console.log(`  ${po.po_number} already loaded, skipped`);
      continue;
    }
    const amount = round2(po.lines.reduce((sum, l) => sum + l.quantity * l.price, 0));
    const deal = await write(`PO ${po.po_number}`, "POST", "/crm/v3/objects/deals", {
      properties: {
        dealname: `${po.po_number} · ${supplier.name}`,
        deal_currency_code: "EUR",
        pipeline: pipeline.id,
        dealstage: pipeline.stages[`PO ${po.stage.toLowerCase()}`],
        document_type: "purchase_order",
        amount,
        po_number: po.po_number,
        budget_code: po.budget_code,
        po_requester: po.po_requester,
      },
    });
    await associate("deals", deal.id, "companies", suppliers.get(po.supplier)!);
    const lines: PoLine[] = [];
    for (const l of po.lines) {
      const li = await write(`line ${po.po_number} ${l.sku}`, "POST", "/crm/v3/objects/line_items", {
        properties: {
          name: l.name, hs_sku: l.sku, quantity: l.quantity, price: l.price, hs_line_item_currency_code: "EUR",
          received_quantity: l.received_quantity, delivery_note_ref: l.delivery_note_ref,
        },
      });
      await associate("line_items", li.id, "deals", deal.id);
      lines.push({ id: li.id, sku: l.sku, quantity: l.quantity, price: l.price, received: l.received_quantity, deliveryNote: l.delivery_note_ref });
    }
    out.set(po.po_number, lines);
    console.log(`  ${po.po_number} loaded (${po.stage})`);
  }
  return out;
}

const eur = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function checkLine(line: DocLine, poLines: PoLine[]) {
  const po = poLines.find((p) => p.sku === line.sku);
  if (!po) return { check: "not_on_po", note: `${line.name} is not on the purchase order.`, ref: "" };
  const diff = (line.price - po.price) / po.price;
  if (Math.abs(diff) > PRICE_TOLERANCE) {
    return { check: "price_off", ref: po.id,
      note: `Invoiced at ${eur(line.price)}; PO price ${eur(po.price)} (${diff > 0 ? "+" : ""}${(diff * 100).toFixed(1)}%).` };
  }
  if (line.quantity > po.received) {
    return { check: "qty_off", ref: po.id, note: `${line.quantity} invoiced, ${po.received} delivered (${po.deliveryNote}).` };
  }
  return { check: "matched", ref: po.id, note: `Matches PO and delivery note ${po.deliveryNote}.` };
}

const approvalLevel = (total: number) => (total <= 5000 ? "team_lead" : total <= 25000 ? "head_of_department" : "cfo");

function auditNote(d: Doc, supplier: string, checks: ReturnType<typeof checkLine>[], total: number) {
  const steps = [
    `Read: email from ${supplier}, sorted as ${d.document_type}.`,
    `Extract: invoice ${d.invoice_number}, ${d.lines.length} line(s), total ${eur(total)}, PO ${d.po_number ?? "none"}.`,
    `Match: ${checks.map((c) => c.note).join(" ")}`,
    `Check: supplier status, IBAN on file, duplicates, tax certificate.`,
    `Decide: ${d.exception_reason ?? `all clear, needs ${approvalLevel(total).replace(/_/g, " ")} approval.`}`,
    `Act: moved to "${d.stage}".`,
  ];
  return `<p><strong>AppBuilder.ai invoice worker · ${d.id}</strong></p><ul>${steps.map((s) => `<li>${s}</li>`).join("")}</ul>`;
}

async function loadHistoryInvoices(pipeline: Pipeline, suppliers: Map<string, string>, poLines: Map<string, PoLine[]>) {
  const texts = data.texts as Record<string, string>;
  for (const d of data.documents.filter((x) => x.history)) {
    const sourceId = `demo-${d.id}`;
    if (!DRY && (await findOne("deals", "source_message_id", sourceId))) {
      console.log(`  ${d.id} already loaded, skipped`);
      continue;
    }
    const supplier = data.suppliers.find((s) => s.key === d.supplier)!;
    const lines = d.lines as DocLine[];
    const net = round2(lines.reduce((sum, l) => sum + l.quantity * l.price, 0));
    const vat = round2(net * VAT);
    const total = round2(net + vat);
    const checks = lines.map((l) => checkLine(l, poLines.get(d.po_number!) ?? []));
    const deal = await write(`invoice ${d.id}`, "POST", "/crm/v3/objects/deals", {
      properties: {
        dealname: `${d.invoice_number} · ${supplier.name}`,
        deal_currency_code: "EUR",
        pipeline: pipeline.id,
        dealstage: pipeline.stages[d.stage],
        amount: total,
        vat_amount: vat,
        document_type: d.document_type,
        invoice_number: d.invoice_number,
        invoice_date: d.invoice_date,
        due_date: d.due_date,
        po_number: d.po_number,
        iban_on_invoice: d.iban_on_invoice,
        match_result: d.match_result,
        approval_level: approvalLevel(total),
        anomaly_flags: d.anomaly_flags.join(";"),
        exception_reason: d.exception_reason ?? "",
        approved_by: (d as { approved_by?: string }).approved_by ?? "",
        order_channel: "email",
        source_message_id: sourceId,
        raw_order_text: texts[d.id] ?? "",
        min_field_confidence: 0.97,
        ...(d.stage === "Approved for payment" ? { closedate: `${d.invoice_date}T15:00:00Z` } : {}),
      },
    });
    await associate("deals", deal.id, "companies", suppliers.get(d.supplier!)!);
    for (const [i, line] of lines.entries()) {
      const c = checks[i]!;
      const li = await write(`line ${d.id} ${line.sku}`, "POST", "/crm/v3/objects/line_items", {
        properties: {
          name: line.name, hs_sku: line.sku ?? "", quantity: line.quantity, price: line.price,
          hs_line_item_currency_code: "EUR", po_line_ref: c.ref, line_check: c.check,
          line_check_note: c.note, field_confidence: 0.97,
        },
      });
      await associate("line_items", li.id, "deals", deal.id);
    }
    const noteObj = await write(`note ${d.id}`, "POST", "/crm/v3/objects/notes", {
      properties: { hs_timestamp: `${d.invoice_date}T10:00:00Z`, hs_note_body: auditNote(d, supplier.name, checks, total) },
    });
    await associate("notes", noteObj.id, "deals", deal.id);
    console.log(`  ${d.id} loaded (${d.stage})`);
  }
}

// The documents that are not history become raw emails to send during the live run,
// with the outcome the invoice worker should reach, for scoring the run.
async function writeLiveMessages() {
  const texts = data.texts as Record<string, string>;
  const live = data.documents.filter((d) => !d.history).map((d) => {
    const supplier = data.suppliers.find((s) => s.key === d.supplier);
    const sender = (d as { sender?: { name: string; email: string } }).sender;
    return {
      id: d.id,
      channel: "email",
      from: supplier?.contact.email ?? sender?.email,
      supplier: supplier?.name ?? sender?.name,
      subject: d.document_type === "invoice" ? `Invoice ${d.invoice_number}` : d.document_type === "reminder"
        ? `Reminder: invoice ${d.invoice_number}` : `Question about invoice ${d.invoice_number}`,
      text: texts[d.id],
      expected: {
        stage: d.stage,
        document_type: d.document_type,
        match_result: d.match_result,
        anomaly_flags: d.anomaly_flags,
        exception: d.exception_reason ?? null,
      },
    };
  });
  const path = `${import.meta.dir}/data/invoices/live-messages.json`;
  if (DRY) {
    console.log(`  [dry-run] write ${live.length} live messages to data/invoices/live-messages.json`);
    return;
  }
  await Bun.write(path, JSON.stringify(live, null, 1) + "\n");
  console.log(`  wrote ${live.length} live messages to data/invoices/live-messages.json`);
}

// ---------- run ----------

const account = await hs("GET", "/account-info/v3/details");
console.log(`Portal ${account.portalId} (${account.accountType}, data in ${account.dataHostingLocation})${DRY ? " · DRY RUN" : ""}`);
console.log("1/6 properties");
await ensureProperties();
await ensureOptions();
if (PROPERTIES_ONLY) {
  console.log("Done (properties only).");
  process.exit(0);
}
console.log("2/6 Procure-to-pay pipeline");
const pipeline = await ensurePipeline();
console.log("3/6 suppliers");
const suppliers = await upsertSuppliers();
console.log("4/6 purchase orders");
const poLines = await loadPurchaseOrders(pipeline, suppliers);
console.log("5/6 history invoices");
await loadHistoryInvoices(pipeline, suppliers, poLines);
console.log("6/6 live messages");
await writeLiveMessages();
console.log("Pipeline:", JSON.stringify(pipeline, null, 1));
console.log("Done.");
