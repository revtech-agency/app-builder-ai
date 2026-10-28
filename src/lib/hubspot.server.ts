// Server-only HTTP helpers for HubSpot and the n8n webhooks. Import dynamically inside
// server-function handlers so the tokens never reach the browser bundle.

const HUBSPOT_BASE = "https://api.hubapi.com";
const N8N_BASE = "https://revtech-agency.app.n8n.cloud/webhook";

export async function hubspot<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT"; body?: unknown } = {},
): Promise<T> {
  const token = process.env["HUBSPOT_ACCESS_TOKEN"];
  if (!token) throw new Error("HubSpot isn't configured yet (missing HUBSPOT_ACCESS_TOKEN).");
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 200);
    try {
      detail = (JSON.parse(text) as { message?: string }).message ?? detail;
    } catch {
      // keep the raw text
    }
    throw new Error(`HubSpot request failed (${res.status}): ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function n8n<T>(webhook: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const key = process.env["N8N_APP_KEY"];
  if (!key)
    throw new Error(`The n8n workflow "${webhook}" isn't configured yet (missing N8N_APP_KEY).`);
  const res = await fetch(`${N8N_BASE}/${webhook}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-appbuilder-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `The n8n workflow "${webhook}" returned ${res.status}. ${text.slice(0, 200)}`.trim(),
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}
