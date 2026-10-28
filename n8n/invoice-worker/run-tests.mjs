// Sends each case in test-cases.json to the invoice-intake webhook and prints expected vs actual.
//
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs            # production webhook
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs --test     # n8n test webhook
//   ... --only 05-duplicate                                                # one case
//   ... --keep    # leave the test invoices in HubSpot (default: archive them afterwards)
//
// Each run creates real deals in HubSpot; they're archived at the end (HubSpot's recycle bin
// keeps them 90 days) unless --keep. Archiving needs HUBSPOT_ACCESS_TOKEN (HUBSPOT_API_KEY, the
// old name, also works). A repeated source_id returns the existing deal (idempotent), so use
// --suffix to run kept invoices again.
import { readFileSync } from "node:fs";

const base = process.env.N8N_BASE_URL || "https://revtech-agency.app.n8n.cloud";
const key = process.env.INVOICE_APP_KEY;
if (!key) {
  console.error("Set INVOICE_APP_KEY to the value of the 'AppBuilder app key' header credential.");
  process.exit(1);
}
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const keep = flag("--keep");
const hsToken = process.env.HUBSPOT_ACCESS_TOKEN ?? process.env.HUBSPOT_API_KEY;
if (!keep && !hsToken) {
  console.error("Set HUBSPOT_ACCESS_TOKEN so the test invoices can be archived afterwards, or pass --keep.");
  process.exit(1);
}

const url = base + (flag("--test") ? "/webhook-test/" : "/webhook/") + "invoice-intake";
const only = value("--only");
const suffix = value("--suffix") || "";
const cases = JSON.parse(readFileSync(new URL("./test-cases.json", import.meta.url), "utf8")).filter(
  (c) => !only || c.id === only,
);

async function hs(path, body) {
  const res = await fetch("https://api.hubapi.com" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + hsToken, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error("HubSpot " + path + " returned " + res.status + ": " + text.slice(0, 200));
  return text ? JSON.parse(text) : {};
}

// Archives only deals this run created from test cases (source_message_id "app-test-…"),
// with their line items and notes. The six sample invoices (demo-INV-H…) are never touched.
async function cleanup(ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const read = await hs("/crm/v3/objects/deals/batch/read", {
    properties: ["source_message_id"],
    inputs: unique.map((id) => ({ id })),
  });
  const dealIds = read.results
    .filter((d) => (d.properties.source_message_id || "").startsWith("app-test-"))
    .map((d) => d.id);
  if (dealIds.length === 0) return;
  const linked = async (to) =>
    (await hs("/crm/v4/associations/deals/" + to + "/batch/read", { inputs: dealIds.map((id) => ({ id })) })).results.flatMap(
      (r) => r.to.map((t) => String(t.toObjectId)),
    );
  const [lineIds, noteIds] = await Promise.all([linked("line_items"), linked("notes")]);
  for (const [type, list] of [["line_items", lineIds], ["notes", noteIds], ["deals", dealIds]]) {
    if (list.length) await hs("/crm/v3/objects/" + type + "/batch/archive", { inputs: list.map((id) => ({ id })) });
  }
  console.log("Archived " + dealIds.length + " test invoices, " + lineIds.length + " line items, " + noteIds.length + " notes.");
}

const rows = [];
const created = [];
try {
  for (const c of cases) {
    if (JSON.stringify(c.request).includes("<FILL FROM PO LINES>")) {
      rows.push({ case: c.id, expected: c.expected.stage, actual: "SKIPPED", result: "fill the PO line placeholders first" });
      continue;
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-appbuilder-key": key },
        body: JSON.stringify({ ...c.request, source_id: c.request.source_id + suffix }),
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      if (!res.ok) {
        rows.push({ case: c.id, expected: c.expected.stage, actual: "HTTP " + res.status, result: text.slice(0, 120) });
        continue;
      }
      const got = JSON.parse(text);
      if (got.deal_id) created.push(String(got.deal_id));
      const problems = [];
      if (got.stage !== c.expected.stage) problems.push("stage " + got.stage);
      for (const f of c.expected.anomaly_flags || []) if (!(got.anomaly_flags || []).includes(f)) problems.push("missing flag " + f);
      if (c.expected.match_result && got.match_result !== c.expected.match_result) problems.push("match " + got.match_result);
      if (c.expected.document_type && got.document_type !== c.expected.document_type) problems.push("type " + got.document_type);
      rows.push({
        case: c.id,
        expected: c.expected.stage,
        actual: got.stage || "(none)",
        result: problems.length ? "FAIL: " + problems.join(", ") : "pass",
      });
    } catch (e) {
      rows.push({ case: c.id, expected: c.expected.stage, actual: "ERROR", result: String(e.message || e).slice(0, 120) });
    }
  }
} finally {
  if (!keep) await cleanup(created);
}
console.table(rows);
const failed = rows.filter((r) => r.result !== "pass" && r.actual !== "SKIPPED").length;
process.exit(failed ? 1 : 0);
