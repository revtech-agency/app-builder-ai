// Sends each document in scripts/hubspot/data/invoices/live-messages.json to the invoice-intake
// webhook and prints expected vs actual.
//
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs            # production webhook
//   INVOICE_APP_KEY=...  node n8n/invoice-worker/run-tests.mjs --test     # n8n test webhook
//   ... --only INV-L5                                                      # one case
//
// Each run creates real deals in HubSpot. A repeated source_id returns the existing deal
// (idempotent), so use --suffix -2 to run the set again under new IDs.
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
const file = new URL("../../scripts/hubspot/data/invoices/live-messages.json", import.meta.url);
const cases = JSON.parse(readFileSync(file, "utf8")).filter((c) => !only || c.id === only);

// "Waiting on supplier" -> "waiting_on_supplier"
const stageKey = (label) => String(label || "").trim().toLowerCase().replace(/\s+/g, "_");

const rows = [];
for (const c of cases) {
  const expectedStage = stageKey(c.expected.stage);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-appbuilder-key": key },
      body: JSON.stringify({
        source_id: "test-" + c.id + suffix,
        filename: c.id + ".txt",
        text: (c.subject ? "Subject: " + c.subject + "\n\n" : "") + c.text,
        submitted_by: c.from,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    if (!res.ok) {
      rows.push({ case: c.id, expected: expectedStage, actual: "HTTP " + res.status, result: text.slice(0, 120) });
      continue;
    }
    const got = JSON.parse(text);
    const problems = [];
    if (got.stage !== expectedStage) problems.push("stage " + got.stage);
    for (const f of c.expected.anomaly_flags || []) {
      if (!(got.anomaly_flags || []).includes(f)) problems.push("missing flag " + f);
    }
    if ((c.expected.anomaly_flags || []).length === 0 && (got.anomaly_flags || []).length > 0) {
      problems.push("unexpected flags " + got.anomaly_flags.join(","));
    }
    if (c.expected.match_result && got.match_result !== c.expected.match_result) problems.push("match " + got.match_result);
    if (c.expected.document_type && got.document_type !== c.expected.document_type) problems.push("type " + got.document_type);
    rows.push({
      case: c.id,
      expected: expectedStage,
      actual: got.stage || "(none)",
      result: problems.length ? "FAIL: " + problems.join(", ") : "pass",
    });
  } catch (e) {
    rows.push({ case: c.id, expected: expectedStage, actual: "ERROR", result: String(e.message || e).slice(0, 120) });
  }
}
console.table(rows);
const failed = rows.filter((r) => r.result !== "pass").length;
console.log(failed ? failed + " of " + rows.length + " failed" : rows.length + " of " + rows.length + " passed");
process.exit(failed ? 1 : 0);
