/**
 * HubSpot setup for the AppBuilder.ai order-worker demo.
 *
 * Creates (or reuses) the properties, the "Orders" deal pipeline and the product
 * catalogue, then loads four demo clients and twelve processed demo orders.
 * Safe to run more than once: everything is looked up before it is created,
 * and an order whose source_message_id already exists is skipped.
 *
 *   bun scripts/hubspot/setup.ts                 # writes to the portal
 *   bun scripts/hubspot/setup.ts --dry-run       # reads only, prints what it would do
 *   bun scripts/hubspot/setup.ts --history-only  # loads only the confirmed orders (the code-map
 *                                                # history) and writes the rest to
 *                                                # data/live-messages.json for the live run
 *
 * Needs HUBSPOT_ACCESS_TOKEN (a private app token, the one the app uses) in .env.local, which git
 * ignores and bun loads on its own. HUBSPOT_API_KEY still works as the old name.
 */
import catalogue from "./data/catalogue.json";
import demo from "./data/demo-orders.json";

const TOKEN = process.env.HUBSPOT_ACCESS_TOKEN ?? process.env.HUBSPOT_API_KEY;
const DRY = process.argv.includes("--dry-run");
const HISTORY_ONLY = process.argv.includes("--history-only");
const BASE = "https://api.hubapi.com";
const GROUP = "appbuilder_order_worker";

if (!TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN is missing: copy .env.example to .env.local and add the token");

type Product = (typeof catalogue)[number];
type Order = (typeof demo.orders)[number];
type Line = Order["lines"][number] & { suggested_sku?: string | null };

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
  products: [
    { name: "item_type", label: "Item type", type: "enumeration", fieldType: "select", options: ["casing", "clip"],
      description: "Whether the item is a casing or a clip. Casings are ordered in metres, clips in thousands of pieces." },
    { name: "casing_family", label: "Casing family", type: "enumeration", fieldType: "select",
      options: ["cellulose", "fibrous", "collagen", "collagen_edible", "collagen_inedible", "polyamide"],
      description: "The material group of the casing. The order worker uses it, with calibre and colour, to suggest the closest item when a client code is unknown." },
    { name: "calibre_mm", label: "Calibre (mm)", type: "number", fieldType: "number",
      description: "Casing diameter in millimetres, as clients write it in orders (for example cal 52)." },
    { name: "colour", label: "Colour", type: "string", fieldType: "text",
      description: "Casing colour or finish as it appears in orders (transparent, mahogany and so on)." },
    { name: "pack_type", label: "Pack type", type: "enumeration", fieldType: "select", options: ["caddy", "roll", "box"],
      description: "The smallest pack the item ships in. Clients order in metres; the order worker converts metres into whole packs of this type." },
    { name: "units_per_pack", label: "Metres per pack", type: "number", fieldType: "number",
      description: "How many metres (or pieces, for clips) one pack holds. Used to turn an order in metres into whole packs." },
    { name: "min_sale_packs", label: "Minimum packs per order", type: "number", fieldType: "number",
      description: "The smallest number of packs that can be sold on one order line. Orders below it go back to the client with the minimum proposed." },
    { name: "price_per_metre", label: "Price per metre", type: "number", fieldType: "number",
      description: "List price per metre (demo values). The product's unit price is the price of one whole pack; this is what offers quote alongside it." },
    { name: "stock_packs", label: "Stock (packs)", type: "number", fieldType: "number",
      description: "Whole packs in stock (demo values). The order worker and the inventory assistant offer alternatives when an item is short." },
  ],
  companies: [
    { name: "payment_status", label: "Payment status", type: "enumeration", fieldType: "select", options: ["current", "overdue"],
      description: "Whether the client is up to date with payments. New orders from an overdue client are held and finance is alerted." },
    { name: "negotiated_skus", label: "Negotiated items (SKUs)", type: "string", fieldType: "textarea",
      description: "The item codes this client may order, one per line. Anything else is left out of the order and turned into a quote request." },
    { name: "appbuilder_plan", label: "AppBuilder.ai plan", type: "enumeration", fieldType: "select", options: ["order_worker"],
      description: "The AppBuilder.ai subscription this client is on. The admin dashboard uses it, with the fees below, to show what each client pays." },
    { name: "appbuilder_monthly_fee", label: "AppBuilder.ai monthly fee (EUR)", type: "number", fieldType: "number",
      description: "Platform subscription the client pays AppBuilder.ai each month, in euros (demo pricing from the deck: 99)." },
    { name: "appbuilder_fee_per_order", label: "AppBuilder.ai fee per order (EUR)", type: "number", fieldType: "number",
      description: "What AppBuilder.ai charges for each order the order worker handles for this client, in euros (demo pricing from the deck: 0.60)." },
    { name: "appbuilder_subscription_start", label: "AppBuilder.ai subscription start", type: "date", fieldType: "date",
      description: "First month the client is billed for. The dashboard counts subscription months and orders from this date." },
  ],
  deals: [
    { name: "delivery_date", label: "Delivery date", type: "date", fieldType: "date",
      description: "The delivery date the client asked for. Every order needs one; the order worker asks the client if it is missing." },
    { name: "order_channel", label: "Order channel", type: "enumeration", fieldType: "select", options: ["email", "whatsapp", "pdf", "app", "efactura"],
      description: "How the order arrived: email, WhatsApp, a PDF attachment, or placed in the AppBuilder.ai app (chat or inventory)." },
    { name: "source_message_id", label: "Source message ID", type: "string", fieldType: "text",
      description: "The ID of the message the order came from. Used to spot the same order sent twice." },
    { name: "raw_order_text", label: "Original order text", type: "string", fieldType: "textarea",
      description: "The order exactly as the client wrote it, kept so staff can check what the order worker read." },
    { name: "exception_reason", label: "Exception reason", type: "string", fieldType: "textarea",
      description: "Why the order needs the client or staff: the problem the order worker found and what it did about it. Empty for clean orders." },
    { name: "min_field_confidence", label: "Lowest field confidence", type: "number", fieldType: "number",
      description: "The order worker's lowest confidence (0 to 1) across the fields it read from this order. Low values send the order to staff." },
  ],
  line_items: [
    { name: "ordered_quantity", label: "Ordered quantity", type: "number", fieldType: "number",
      description: "The quantity exactly as the client ordered it, before conversion into packs." },
    { name: "ordered_unit", label: "Ordered unit", type: "enumeration", fieldType: "select", options: ["m", "thousand_pcs"],
      description: "The unit the client ordered in: metres for casings, thousands of pieces for clips." },
    { name: "client_code_as_written", label: "Client's item code", type: "string", fieldType: "text",
      description: "The client's own code for this item, as written in the order. Confirmed lines form the client's code map, so the next order with the same code matches on its own." },
    { name: "rounding_note", label: "Rounding note", type: "string", fieldType: "text",
      description: "How the ordered quantity was rounded to whole packs, when it did not divide evenly." },
    { name: "field_confidence", label: "Read confidence", type: "number", fieldType: "number",
      description: "How sure the order worker was (0 to 1) when it read this line from the order." },
  ],
};

async function ensureProperties() {
  for (const [object, props] of Object.entries(PROPERTIES)) {
    const groups = await hs("GET", `/crm/v3/properties/${object}/groups`);
    if (!groups.results.some((g: any) => g.name === GROUP)) {
      await write(`group ${object}.${GROUP}`, "POST", `/crm/v3/properties/${object}/groups`, {
        name: GROUP, label: "AppBuilder.ai order worker", displayOrder: -1,
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

// ---------- pipeline ----------

const STAGES: { label: string; probability: string; closed?: boolean }[] = [
  { label: "Received", probability: "0.1" },
  { label: "Waiting on client", probability: "0.3" },
  { label: "Needs staff", probability: "0.3" },
  { label: "Ready to confirm", probability: "0.8" },
  { label: "Confirmed", probability: "1.0", closed: true },
  { label: "Duplicate", probability: "0.0", closed: true },
  { label: "Rejected", probability: "0.0", closed: true },
];

async function ensurePipeline(): Promise<{ id: string; stages: Record<string, string> }> {
  const all = (await hs("GET", "/crm/v3/pipelines/deals")).results;
  let pipeline = all.find((p: any) => p.label === "Orders");
  if (!pipeline) {
    pipeline = await write("pipeline Orders", "POST", "/crm/v3/pipelines/deals", {
      label: "Orders",
      displayOrder: 1,
      stages: STAGES.map((s, i) => ({
        label: s.label, displayOrder: i,
        metadata: { probability: s.probability, ...(s.closed ? { isClosed: "true" } : {}) },
      })),
    });
    console.log("  created pipeline Orders");
  } else {
    console.log("  pipeline Orders exists, kept as is");
  }
  const stages: Record<string, string> = {};
  for (const s of pipeline.stages ?? []) stages[s.label] = s.id;
  return { id: pipeline.id, stages };
}

// ---------- products ----------

async function listAll(object: string, properties: string[]): Promise<any[]> {
  const out: any[] = [];
  let after: string | undefined;
  do {
    const page = await hs("GET", `/crm/v3/objects/${object}?limit=100&properties=${properties.join(",")}${after ? `&after=${after}` : ""}`);
    out.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return out;
}

function productProps(p: Product) {
  return {
    name: p.name, hs_sku: p.sku, item_type: p.item_type, casing_family: p.casing_family,
    calibre_mm: p.calibre_mm ?? "", colour: p.colour, pack_type: p.pack_type,
    units_per_pack: p.units_per_pack, min_sale_packs: p.min_sale_packs,
    price: p.price, price_per_metre: p.price_per_metre, stock_packs: p.stock_packs,
  };
}

async function upsertProducts(): Promise<Map<string, string>> {
  const bySku = new Map<string, string>();
  for (const p of await listAll("products", ["hs_sku"])) if (p.properties.hs_sku) bySku.set(p.properties.hs_sku, p.id);

  const toCreate = catalogue.filter((p) => !bySku.has(p.sku));
  const toUpdate = catalogue.filter((p) => bySku.has(p.sku));
  for (let i = 0; i < toCreate.length; i += 100) {
    const batch = toCreate.slice(i, i + 100);
    const res = await write(`create ${batch.length} products`, "POST", "/crm/v3/objects/products/batch/create", {
      inputs: batch.map((p) => ({ properties: productProps(p) })),
    });
    for (const r of res.results) bySku.set(r.properties.hs_sku, r.id);
  }
  for (let i = 0; i < toUpdate.length; i += 100) {
    const batch = toUpdate.slice(i, i + 100);
    await write(`update ${batch.length} products`, "POST", "/crm/v3/objects/products/batch/update", {
      inputs: batch.map((p) => ({ id: bySku.get(p.sku), properties: productProps(p) })),
    });
  }
  console.log(`  products: ${toCreate.length} created, ${toUpdate.length} updated`);
  return bySku;
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

async function upsertClients(): Promise<Map<string, { companyId: string; contactId: string }>> {
  const ids = new Map<string, { companyId: string; contactId: string }>();
  for (const c of demo.clients) {
    const props = {
      name: c.name, domain: c.domain, city: c.city, country: "Romania",
      payment_status: c.payment_status, negotiated_skus: c.negotiated_skus.join("\n"),
      appbuilder_plan: c.plan.name, appbuilder_monthly_fee: c.plan.monthly_fee,
      appbuilder_fee_per_order: c.plan.fee_per_order, appbuilder_subscription_start: c.plan.start,
    };
    let companyId = await findOne("companies", "domain", c.domain);
    if (companyId) await write(`update company ${c.name}`, "PATCH", `/crm/v3/objects/companies/${companyId}`, { properties: props });
    else companyId = (await write(`create company ${c.name}`, "POST", "/crm/v3/objects/companies", { properties: props })).id;

    let contactId = await findOne("contacts", "email", c.contact.email);
    if (!contactId) {
      contactId = (await write(`create contact ${c.contact.email}`, "POST", "/crm/v3/objects/contacts", { properties: c.contact })).id;
      await associate("contacts", contactId!, "companies", companyId!);
    }
    ids.set(c.key, { companyId: companyId!, contactId: contactId! });
    console.log(`  client ${c.name} ready`);
  }
  return ids;
}

function packsFor(line: Line, product: Product) {
  const exact = line.metres / product.units_per_pack;
  const packs = Math.max(Math.ceil(exact - 1e-9), product.min_sale_packs);
  const shipped = packs * product.units_per_pack;
  const note = shipped === line.metres ? "" :
    `${line.metres.toLocaleString("en")} m rounded up to ${packs} ${product.pack_type}s (${shipped.toLocaleString("en")} m)`;
  return { packs, note };
}

function auditNote(o: Order, client: string) {
  const steps = [
    `Read: ${o.channel} message from ${client}, sorted as a new order.`,
    `Extract: ${o.lines.length} line(s) and delivery date ${o.delivery_date}.`,
    `Check: client codes mapped, negotiated list checked, metres converted into packs.`,
    `Decide: ${o.exception_reason ?? "all clear, ready for one-click confirm."}`,
    `Act: deal moved to "${o.stage}".`,
  ];
  return `<p><strong>AppBuilder.ai order worker · ${o.id}</strong></p><ul>${steps.map((s) => `<li>${s}</li>`).join("")}</ul>`;
}

async function loadOrders(pipeline: { id: string; stages: Record<string, string> }, skuToId: Map<string, string>,
                          clients: Map<string, { companyId: string; contactId: string }>) {
  const bySku = new Map(catalogue.map((p) => [p.sku, p]));
  const orders = HISTORY_ONLY ? demo.orders.filter((o) => o.stage === "Confirmed") : demo.orders;
  for (const o of orders) {
    const sourceId = `demo-${o.id}`;
    if (!DRY && (await findOne("deals", "source_message_id", sourceId))) {
      console.log(`  ${o.id} already loaded, skipped`);
      continue;
    }
    const client = demo.clients.find((c) => c.key === o.client)!;
    const ids = clients.get(o.client)!;
    const lines = o.lines as Line[];
    // Same total as placeOrder: whole packs times the pack price; unmatched lines count as 0.
    const amount =
      Math.round(
        lines.reduce((sum, line) => {
          const product = line.sku ? bySku.get(line.sku) : undefined;
          return sum + (product ? packsFor(line, product).packs * product.price : 0);
        }, 0) * 100,
      ) / 100;
    const deal = await write(`deal ${o.id}`, "POST", "/crm/v3/objects/deals", {
      properties: {
        dealname: `${o.id} · ${client.name}`,
        amount,
        deal_currency_code: "EUR",
        pipeline: pipeline.id,
        dealstage: pipeline.stages[o.stage],
        delivery_date: o.delivery_date,
        order_channel: o.channel,
        source_message_id: sourceId,
        raw_order_text: o.raw_order_text,
        exception_reason: o.exception_reason ?? "",
        min_field_confidence: lines.length ? Math.min(...lines.map((l) => l.confidence)) : "",
        ...(o.stage === "Confirmed" ? { closedate: o.received } : {}),
      },
    });
    await associate("deals", deal.id, "companies", ids.companyId);
    await associate("deals", deal.id, "contacts", ids.contactId);

    for (const line of lines) {
      const product = line.sku ? bySku.get(line.sku) : undefined;
      const { packs, note } = product ? packsFor(line, product) : { packs: 0, note: "" };
      const li = await write(`line ${o.id} ${line.sku ?? line.client_code}`, "POST", "/crm/v3/objects/line_items", {
        properties: {
          ...(product
            ? { hs_product_id: skuToId.get(product.sku), quantity: packs, price: product.price }
            : { name: `${line.client_code} (no match yet, closest: ${line.suggested_sku})`, quantity: 0 }),
          hs_line_item_currency_code: "EUR",
          ordered_quantity: line.metres,
          ordered_unit: "m",
          client_code_as_written: line.client_code ?? "",
          rounding_note: note,
          field_confidence: line.confidence,
        },
      });
      await associate("line_items", li.id, "deals", deal.id);
    }

    const noteObj = await write(`note ${o.id}`, "POST", "/crm/v3/objects/notes", {
      properties: { hs_timestamp: `${o.received}T09:00:00Z`, hs_note_body: auditNote(o, client.name) },
    });
    await associate("notes", noteObj.id, "deals", deal.id);
    console.log(`  ${o.id} loaded (${o.stage})`);
  }
}

// The orders that are not history become raw messages to send during the live run,
// with the outcome the order worker should reach, for scoring the run.
async function writeLiveMessages() {
  const live = demo.orders.filter((o) => o.stage !== "Confirmed").map((o) => {
    const client = demo.clients.find((c) => c.key === o.client)!;
    return {
      id: o.id,
      channel: o.channel,
      from: o.channel === "whatsapp" ? client.contact.mobilephone : client.contact.email,
      client: client.name,
      subject: o.channel === "email" ? `Comanda ${client.name.replace(" (demo)", "")}` : undefined,
      text: o.raw_order_text,
      expected: { stage: o.stage, exception: o.exception_reason ?? null },
    };
  });
  const path = `${import.meta.dir}/data/live-messages.json`;
  await Bun.write(path, JSON.stringify(live, null, 1) + "\n");
  console.log(`  wrote ${live.length} live messages to data/live-messages.json`);
}

// ---------- run ----------

const account = await hs("GET", "/account-info/v3/details");
console.log(`Portal ${account.portalId} (${account.accountType}, data in ${account.dataHostingLocation})${DRY ? " · DRY RUN" : ""}`);
console.log("1/5 properties");
await ensureProperties();
console.log("2/5 Orders pipeline");
const pipeline = await ensurePipeline();
console.log("3/5 products");
const skuToId = await upsertProducts();
console.log("4/5 demo clients");
const clients = await upsertClients();
console.log(`5/5 demo orders${HISTORY_ONLY ? " (history only)" : ""}`);
await loadOrders(pipeline, skuToId, clients);
if (HISTORY_ONLY) await writeLiveMessages();
console.log("Done.");
