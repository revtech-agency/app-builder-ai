/**
 * Checks that the pipeline and stage IDs hardcoded in the app still exist in HubSpot with
 * the same labels. Reads only; exits 1 on any difference so it can gate a demo or CI.
 *
 *   bun scripts/hubspot/check-ids.ts
 *
 * Needs HUBSPOT_API_KEY (a private app token) in .env.local, which git ignores.
 */
import { INVOICE_STAGES, P2P_PIPELINE_ID, PO_STAGES } from "../../src/lib/invoice-rules";
import {
  PIPELINE_ID as ORDERS_PIPELINE_ID,
  STAGES as ORDER_STAGES,
} from "../../src/lib/order-rules";

const TOKEN = process.env.HUBSPOT_API_KEY;
if (!TOKEN)
  throw new Error("HUBSPOT_API_KEY is missing: copy .env.example to .env.local and add the token");

type Pipeline = { label: string; stages: { id: string; label: string }[] };

async function pipeline(id: string): Promise<Pipeline> {
  const res = await fetch(`https://api.hubapi.com/crm/v3/pipelines/deals/${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok)
    throw new Error(`Pipeline ${id} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const expected: [string, Record<string, { label: string }>][] = [
  [P2P_PIPELINE_ID, { ...PO_STAGES, ...INVOICE_STAGES }],
  [ORDERS_PIPELINE_ID, ORDER_STAGES],
];

let problems = 0;
for (const [id, stages] of expected) {
  const live = await pipeline(id);
  const byId = new Map(live.stages.map((s) => [s.id, s.label]));
  for (const [stageId, { label }] of Object.entries(stages)) {
    const got = byId.get(stageId);
    if (got !== label) {
      problems++;
      console.log(
        `✗ ${live.label} · ${stageId}: app says "${label}", HubSpot says ${got ? `"${got}"` : "nothing"}`,
      );
    }
  }
  for (const s of live.stages) {
    if (!(s.id in stages))
      console.log(`· ${live.label} · ${s.id} "${s.label}" is in HubSpot but not in the app`);
  }
  console.log(`${live.label} (${id}): ${Object.keys(stages).length} stages checked`);
}
if (problems) {
  console.log(
    `${problems} difference(s). Update the constants and the n8n Apply Rules node together.`,
  );
  process.exit(1);
}
console.log("All hardcoded pipeline and stage IDs match HubSpot.");
