# IMPROVEMENTS — AppBuilder.ai

> The difference from FEATURES: this is what **already exists** and needs to get better.
> Sorted by **jury impact / effort**. The number on the right = the judging points it targets.

## Priority 1 — big win, small effort

| ID | Improvement | Criterion | Effort | Owner | Status |
|---|---|---|---|---|---|
| I-01 | **Split the monolithic agent into agents with clear roles** (intake, matching, risk, finance) + an orchestrator. Each agent = a separate file with typed input/output | AGENT 25%, ARCH 15% | M | ⚠️ | 🔴 |
| I-02 | **Rules taken out of the prompt into code/config** (`rules.yaml` or `rules.ts`). The LLM extracts, the rules decide | AGENT, DOM, ARCH | S | Lip (proposed) | 🔴 |
| I-03 | **Explicit exception messages**: not "error", but "Unknown client code: XYZ-12. Closest: XYZ-21 (score 0.82). Proposal: human confirmation" | AGENT, FUNC | S | ⚠️ | 🔴 |
| I-04 | **The prompt and the model version in the repo** (`/prompts`, `MODEL=` in `.env.example`) | ARCH | S | ⚠️ | 🔴 |
| I-05 | **The n8n flows exported into the repo** (`/n8n/*.json`) | ARCH | S | ⚠️ | 🔴 |

## Priority 1b — found from the code (28 Oct)

| ID | Improvement | Criterion | Effort | Owner | Status |
|---|---|---|---|---|---|
| I-06 | **A single schema source**: `drizzle/migrations/` (decided 28 Oct); the version from PR #1 isn't merged. The HubSpot schema (properties/pipeline) stays in `setup.ts`; take the hardcoded IDs out of `order-rules.ts` into a config | ARCH 15% | S | Daniel | 🟡 schema decided; the hardcoded IDs remain (BUGS B-07, B-19) |
| I-07 | **Secrets and config**: complete `.env.example` (all the names in DOCUMENTATION §3), a single name for the HubSpot token, `.env` taken out of git. No real secrets were found in the code/history — check n8n too (`x-appbuilder-key`) | ARCH | S | ⚠️ | 🔴 (B-08) |
| I-08 | **Tests where the money and the access are**: `placeOrder` (with a HubSpot mock), `visibleCompanies` (admin / demo / domain / unconfirmed email), a parity test between the rules in TS and those in n8n; CI with `bun run test` + `lint` + `build` | ARCH, FUNC | M | ⚠️ | 🔴 (B-14) |
| I-09 | **Rules as shared data**: a single rules file (thresholds, tolerances, approval limits) read by both the app and n8n (through an app endpoint), instead of copies in the Code node + TS | AGENT, ARCH, DOM | M | Lip | 🔴 (B-10) |
| I-10b | **Evidence runner**: a script that sends the 12 messages in `live-messages.json` (and, after the pivot, the 12 invoice documents) to the webhook and writes `evidence/results.md` with expected vs actual | FUNC 20% | M | ⚠️ | 🔴 (F-08) |
| I-11b | **Idempotency + rollback + stock reservation** in `placeOrder` | FUNC, DOM | S | ⚠️ | 🔴 (B-09) |
| I-12b | **The scenario decision before Lovable prompt 2**: if AP/invoices is chosen, prompt 1 (`ap_reviewer` role) goes only after B-07; if not, don't send the prompts (they'd add ~5 pages and 6 server fns with no tests besides the limits test) | AGENT, ORIG | — | the team | 🔴 (D2) |

## Priority 2 — big win, big effort

| ID | Improvement | Criterion | Effort | Owner | Status |
|---|---|---|---|---|---|
| I-10 | Moving the scenario from "orders for a cured-meats supplier" to a bank process (see D2 in STATUS) | DOM, ORIG, BIZ | L | the team | 🔴 |
| I-11 | Retry + fallback on tool errors (banking API down, LLM timeout, invalid JSON) | AGENT ("unexpected situations") | M | ⚠️ | 🔴 |
| I-12 | Trace page per case (timeline with the agent's steps) | FUNC, AGENT | M | ⚠️ | 🔴 |

## Priority 3 — landing page (small jury impact)

> The landing page counts only indirectly towards BIZ (10%). We don't invest here any more once the demo works.

| ID | Improvement | Status |
|---|---|---|
| I-20 | "Try the demo" becomes the primary CTA in the hero | 🟡 PR #1 |
| I-21 | "Open the app" → "Sign in", only in the header | 🟡 PR #1 |
| I-22 | CTA on every card in "We sell the worker, not the tool" | 🟡 PR #1 |
| I-23 | Contact form on the page (`#contact`) | 🟡 PR #1 |

## Deck

| ID | Improvement | Status |
|---|---|---|
| I-30 | The problem slides rewritten with a banking angle | 🔴 |
| I-31 | "Agent architecture" slide (diagram of orchestrator + agents + tools) | 🔴 |
| I-32 | Slide with the test results: **X out of N cases correct**, how many exceptions caught | 🔴 |
| I-33 | Business case redone on the cost of the bank's process (the old figures, €1.37/order and the €730M market, are no longer relevant) | 🔴 |
| I-34 | Numerical inconsistencies: "~40% of labour cost" vs 23% on offers; €560 vs €349/month | 🔴 |
