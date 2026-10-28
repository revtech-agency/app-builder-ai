// Sends each case in test-cases.json to the invoice-intake webhook and prints expected vs actual.
//
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs            # production webhook
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs --test     # n8n test webhook
//   ... --only 05-duplicate                                                # one case
//
// Each run creates real deals in HubSpot. A repeated source_id returns the existing deal
// (idempotent), so use --suffix to run the set again under new IDs.
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

const url = base + (flag("--test") ? "/webhook-test/" : "/webhook/") + "invoice-intake";
const only = value("--only");
const suffix = value("--suffix") || "";
const cases = JSON.parse(readFileSync(new URL("./test-cases.json", import.meta.url), "utf8")).filter(
  (c) => !only || c.id === only,
);

const rows = [];
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
console.table(rows);
const failed = rows.filter((r) => r.result !== "pass" && r.actual !== "SKIPPED").length;
process.exit(failed ? 1 : 0);
