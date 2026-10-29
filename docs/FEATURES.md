# FEATURES — AppBuilder.ai

> Every feature has: ID, priority, the judging criterion it targets, owner, status.
> **Priority = how much it weighs with the jury**, not how nice it is. P0 = without it we lose, P1 = raises our score, P2 = after the hackathon.

Judging criteria (short code): **ORIG** 15% · **DOM** 15% · **AGENT** 25% · **FUNC** 20% · **ARCH** 15% · **BIZ** 10%

## P0 — the core scenario that has to run live

| ID | Feature | Criterion | Owner | Status |
|---|---|---|---|---|
| F-01 | **Intake agent**: reads the input (email / form), extracts structured data | AGENT, FUNC | ⚠️ | 🟢 invoices: the `Process supplier invoices` flow (Gmail + webhook `invoice-intake`, PDF → text, Information Extractor with Claude), exported in `n8n/invoice-worker/`. 🟡 orders: in n8n, not in the repo |
| F-02 | **Matching agent**: maps client codes/names to the catalogue, converts quantities | AGENT, DOM | ⚠️ | 🟢 invoices: three-way match PO ↔ received quantity (delivery notes) ↔ invoice, on every line (`line_check`: matched / price_off / qty_off / not_on_po), in `Apply Rules`; shown in the app under "Three-way match". 🟡 orders: the conversion to packs is in code (`order-rules.ts`); matching on client code is in n8n, not verifiable |
| F-03 | **Risk agent**: fixed rules in code (exposure, arrears, duplicates, limits) — the LLM does NOT decide on money | AGENT, DOM | Lip (proposed) | 🟢 invoices: fixed rules in the *Code node* `Apply Rules` (duplicate, IBAN different or changed in the last 30 days, supplier not approved or unknown, split purchase, confidence < 0.8, price ±2%, quantity above what was received, tax certificate); the approval thresholds (5,000/25,000) and the checks shown to the reviewer are also in `invoice-rules.ts` (tested). The TS ↔ n8n duplication remains (B-10). 🟡 orders: arrears + stock + packs in `order-rules.ts` (code, tested) |
| F-04 | **Orchestrator**: decides the steps, routes to exception, retries on tool errors | AGENT | ⚠️ | 🔴 |
| F-05 | **Exception queue** for a person: clear reason, what the agent saw, what it proposes | AGENT, FUNC | ⚠️ | 🟢 invoices: the `/app/invoices` queue + the invoice page with the reason (`exception_reason`), the flags, every check passed/failed, the three-way match and the supplier's data; the person decides. Orders: the client sees `exception_reason` on the Orders page |
| F-06 | **Banking mock API** (balance, transactions, incoming payments) in a format close to PSD2 | AGENT (tool use), DOM | ⚠️ | 🔴 |
| F-07 | **Trace per case**: every decision saved with step, tool called, input, output, rule applied | FUNC, ARCH | ⚠️ | 🟡 invoices: the worker writes an audit note on every invoice with each check and its result; every human decision adds a note (`decideInvoice`); both show in the app under "Activity". There's no step-by-step timeline yet (tool, input, output). Orders: note only in the seed data; `placeOrder` doesn't write a note |
| F-08 | **Synthetic data set** + a script that runs the whole set and reports X/N correct | FUNC, DOM | Lip (proposed) | 🟢 invoices: 12 cases in `n8n/invoice-worker/test-cases.json` + `run-tests.mjs` → 12/12 correct (`evidence/invoice-worker-run-2026-10-29.md`). 🟡 orders: 12 cases with expected result in `scripts/hubspot/data/`, no runner |
| F-09 | **"Try the demo"** working from the landing page | FUNC | Daniel | 🟡 two password-free demo accounts (magic link): orders (`DEMO_EMAIL`, sees only the demo company) and invoice desk (`DEMO_AP_EMAIL`, with a step-by-step guide and Reset demo). ⚠️ The invoice desk account is shared: a Reset demo by one visitor deletes the invoices another one submitted. To retest live before the presentation |

## P1 — raises our score

| ID | Feature | Criterion | Owner | Status |
|---|---|---|---|---|
| F-10 | Learning from corrections: when a person corrects a match, it's saved as a rule / alias | ORIG, AGENT | ⚠️ | 🟡 data model only: `client_code_as_written` on line items = the code map. No logic in the repo |
| F-11 | Finance agent: invoice → payment reconciliation → financing proposal (if D2 = order-to-cash) | ORIG, DOM, BIZ | ⚠️ | 🔴 |
| F-12 | Screen for the bank employee (officer / operator) with the exception queue and the trace | FUNC, BIZ | Daniel | 🟡 the invoice desk is the AP employee's screen: queue, detail, decisions, "Ask the worker" chat. The trace is the audit note, not a timeline |
| F-13 | The jury can send an input into the demo themselves (email / form) | FUNC | Daniel | 🟡 `Submit document` (text or PDF) in the invoice desk and email to `demo+invoices@appbuilder.ai`. ⚠️ Writes to the shared demo portal |
| F-14 | "Talk to us" form connected to HubSpot | BIZ | Daniel | 🟢 on `main` (`contact-form.tsx`, Forms API, hardcoded IDs) |
| F-15 | Admin dashboard: MRR, revenue/month, billable orders from HubSpot | BIZ | Daniel | 🟢 `/app/dashboard`, `billing.ts` tested (wasn't in the draft) |
| F-16 | "Order assistant" chat + cart + inventory with pack rules | FUNC, DOM | Daniel | 🟢 `/app/$companyId/*` (wasn't in the draft); the chat depends on n8n |
| F-17 | Money protected: euros of risky payments held before payment, by reason, with the benchmark and the cost | BIZ, FUNC | Daniel | 🟢 `src/lib/money.ts` (tested), overview, queue At risk column, invoice page banner, result email line (n8n, same rules, parity test) |
| F-18 | RO e-Factura intake (ANAF SPV) | DOM, FUNC | Daniel | 🟡 simulated SPV inbox + XML upload on `/app/efactura`; the XML fields become the worker's text (no PDF reading) and go through the same worker and rules. Live SPV connection not built |

## P2 — after the hackathon

| ID | Feature | Note |
|---|---|---|
| F-20 | The "quote" and "purchasing" workers | don't matter for Raiffeisen |
| F-21 | Full `/privacy` page | the link exists in PR #1 |
| F-22 | Multi-tenant / several SME clients | |

## How to add a feature

1. New row in the right table, next ID.
2. Write **which judging criterion it targets**. If it targets none → P2 automatically.
3. Branch `feat/F-XX-short-name`, PR with the ID in the title.
