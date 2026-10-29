# STATUS — AppBuilder.ai @ NexxtAI Hackathon 2026

> Updated 29 Oct 2026, after the email intake went live. Track: Raiffeisen Bank, **AI for Operational
> Efficiency**. Live at [nexxt.appbuilder.ai](https://nexxt.appbuilder.ai). Everything in the demo is
> synthetic: suppliers, purchase orders, invoices, clients and prices.

## What we built

An AI worker for a bank's accounts-payable team. It checks every supplier invoice against its
purchase order and its delivery note before it is paid (a three-way match), runs 12 coded checks,
from a duplicate to a changed IBAN, and sends the invoice to one of four outcomes: ready to approve,
waiting on supplier, needs review, duplicate. The LLM (Claude) only reads the document; fixed rules
in code decide, and a person approves every payment.

The same flow (read, look up, apply the rules, flag, a person decides) adapts to other rule-based
document processes. The repo also holds an earlier quote & order worker for an SME casings supplier,
built on the same pattern.

## Decisions

| # | Decision | Outcome |
|---|---|---|
| D1 | Track | Raiffeisen, AI for Operational Efficiency |
| D2 | Banking scenario | Supplier invoices, three-way match (accounts payable) |
| D3 | LLM | Claude Sonnet 5.5 through the Anthropic API, in n8n (document reading and the reviewer chat). The app doesn't call the LLM directly |
| D4 | Database schema | One source: `drizzle/migrations/` (one table, `user_roles`, with row-level security) |

## Components

| Component | Status | Where |
|---|---|---|
| Invoice worker (n8n) | 🟢 Live. Reads invoices from email or from the app, applies the rules, writes the HubSpot deal, line items and an audit note listing every check, emails the result to the reviewer and asks the supplier for anything missing | `n8n/invoice-worker/`, workflow `Kxhmr00uS4MBXTSO` |
| Email intake | 🟢 Live. Watches demo+invoices@appbuilder.ai and the demo sends to daniel@tigros.io (and its aliases daniel@appbuilder.ai, demo@appbuilder.ai) every minute; never reads back its own emails | `n8n/invoice-worker/README.md` (Email intake) |
| e-Factura intake | 🟡 Simulated SPV: the app reads RO e-Factura XML (demo invoices or an uploaded file) and sends it through the same worker as source e-Factura. No live ANAF connection (needs OAuth with the company's qualified certificate) | `src/lib/efactura.ts`, `/app/efactura` |
| Money protected | 🟢 Risky payments held before payment, by reason (duplicates, unverified payees, split purchases, no PO, overbilling per line), on the overview, the queue (At risk column), each invoice page and the result email; benchmark (APQC 0.8–2%) and cost (€1.50 per invoice, draft) card on the overview | `src/lib/money.ts` |
| Reviewer chat ("Ask the worker") | 🟢 Live. Read-only agent with six tools: the invoice, its lines, its audit note, the supplier and the PO | workflows `HI8tvI2HG70NlgPo`, `rc72KPALhtJhwLZm` |
| Invoice desk (app) | 🟢 Live. Queue, invoice page (three-way match, every check passed or failed, activity, chat), decisions (approve, send back, reject, duplicate), Submit document, Email intake page with demo invoices to send, suppliers, POs, team, approval rules, Reset demo, step-by-step demo guide | `src/routes/app/` |
| Landing page | 🟢 Live. Leads with the invoice worker, matching the finals deck | `src/routes/index.tsx` |
| HubSpot setup | 🟢 One rerunnable script builds the Procure-to-pay pipeline, properties, 6 suppliers, 10 POs and the invoice history on any portal (`--dry-run`, `--properties-only`) | `scripts/hubspot/setup-invoices.ts` |
| Test set and evidence | 🟢 12 synthetic invoices with expected stage and flags; 12 of 12 correct on four runs in a row | `n8n/invoice-worker/test-cases.json`, `run-tests.mjs`, `evidence/` |
| Demo invoices | 🟢 The 12 test cases as PDFs and emails, ready to send | `demo-invoices/`, Email intake page |
| Unit tests | 🟢 Rules, billing, routing, demo guide, email intake, rate limits | `src/test/` (`bun run test`) |
| Quote & order worker | 🟡 Runs in n8n; its six workflows aren't exported to the repo. The app side (order portal, pack rules) is in the repo | `src/routes/app/$companyId/`, `src/lib/order-rules.ts` |

Legend: 🟢 done · 🟡 partial

## Known limits

- Synthetic data only: 12 cases don't prove reliability on real invoices.
- HubSpot stands in for the bank's ERP; only the lookups and the writes would change.
- Scanned, image-only PDFs can't be read yet.
- The demo model runs through the Anthropic API (US). Production is planned in the EU; the EU model
  route is still to be confirmed.
- The learning loop (staff corrections becoming history for the next invoice) isn't built yet.
- The invoice rules exist twice, in the n8n `Apply Rules` node and in `src/lib/invoice-rules.ts`
  (B-10); the tests check the mailbox list and the result email against the n8n code, not the rules.
- The demo accounts are shared by every visitor. Submitting, sending demo invoices, the chat,
  ordering and Reset demo are rate limited per account (`src/lib/rate-limit.ts`), but the limits
  are counted per server instance, so they slow abuse rather than stop it.

Open bugs and their status: [`docs/BUGS.md`](BUGS.md). Setup and environment variables:
[`docs/DOCUMENTATION.md`](DOCUMENTATION.md).

## Team

| Member | Role |
|---|---|
| Daniel Secareanu | Product, domain and go-to-market; tech lead (repo, Lovable, n8n, HubSpot, deploy) |
| Serin Noman | Product; shapes the product and the n8n flow logic |
| Damian Cirlan | Cloud ops: EU hosting for n8n, deployment, the demo setup script |
| Philipe Soueidan | Business analysis: the process, its rules and exceptions, test data and documentation |

## Where things live

| Tool | Used for | Source of truth for |
|---|---|---|
| GitHub (this repo) | Code, SQL migrations, n8n exports, prompts, docs, test evidence | All code and docs |
| Lovable | UI editor, synced with `main` | Nothing on its own |
| Supabase | Sign-in and the `user_roles` table | The schema, through `drizzle/migrations/` |
| HubSpot (portal 149650024) | Stands in for the bank's systems: suppliers, POs, invoices | Demo CRM data; properties in `scripts/hubspot/` |
| n8n (revtech-agency.app.n8n.cloud) | The AI workers and the LLM calls | The live workflows; exports in `n8n/invoice-worker/` |

Secrets live only in `.env.local` and the deploy settings, never in the repo. `.env` is tracked by
Lovable and holds only the public Supabase URL and publishable key.

## Change log

| When | What |
|---|---|
| 28 Oct | Project documents created; first invoice desk and HubSpot setup |
| 29 Oct | Invoice worker live in n8n, 12 of 12 test cases correct (`evidence/`) |
| 29 Oct | Email intake: watched mailboxes, result email to the reviewer, Email intake page, demo invoices |
| 29 Oct | Landing page aligned with the finals deck; rate limits on the shared demo accounts; STATUS rewritten for outside readers |
| 29 Oct | e-Factura intake (simulated SPV); money held before payment shown on the overview, queue, invoice page and result email; Source column in the queue |
| 29 Oct | Hackathon over: the public one-click demo is closed by default (`DEMO_ENABLED`); the landing page offers "Book a demo" instead |
