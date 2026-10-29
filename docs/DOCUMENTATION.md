# AppBuilder.ai — Documentation

> The jury reads this next to the root `README.md` to check **Architecture & reproducibility (15%)** and **Functional completeness & testability (20%)**.
> Checked against the code on `main` @ `0b6629f`, the HubSpot portal 149650024 and the live site (29 Oct). ⚠️ = can't be found from the repo, must be filled in by whoever owns the component.

---

## 1. What it does

AppBuilder.ai sells AI workers for back-office work. For the Raiffeisen challenge the main scenario is **supplier invoice processing (accounts payable, three-way match)**: an AI worker in n8n reads each supplier invoice, matches it against the purchase order and what the delivery notes say was received, applies fixed procurement rules and puts the invoice in the right stage of a HubSpot pipeline. An accounts-payable reviewer works the exceptions in the app's **invoice desk** and makes the money decisions. HubSpot (portal 149650024, synthetic demo data) stands in for the bank's systems.

The earlier scenario, an **order worker** for a distributor's clients (demo data: casings for cured meats, sold by the metre), is still in the app as the casings order portal (`/app/$companyId`).

The invoice flow, as it is in the code and in the n8n export:

```
Supplier email (Gmail demo+invoices@appbuilder.ai)        Reviewer in the app: /app/invoices/new
              │                                                      │ server fn submitDocument (text or PDF)
              ▼                                                      ▼
n8n "Process supplier invoices"  ◄──────────── POST /webhook/invoice-intake (header x-appbuilder-key)
   1. PDF → text (Extract From File)
   2. Information Extractor + Claude: supplier, VAT ID, IBAN, invoice number, dates, PO, lines,
      confidence per field (the LLM only extracts; "don't invent values")
   3. HubSpot lookups: supplier (company), PO + its line items, earlier invoices
   4. Code node "Apply Rules" (CODE, no LLM): duplicate, supplier status, IBAN, certificate,
      split purchase, confidence, three-way match per line, approval level; worst stage wins
   5. HubSpot: invoice deal in Procure-to-pay, line items with line_check, audit note with every check
   6. if something is missing: email to the supplier (Gmail); response to the app

Invoice desk (app, HubSpot via server fns)
   /app/invoices        queue (listInvoices)
   /app/invoices/$id    three-way match, every check, supplier, activity (getInvoice)
                        "Ask the worker" chat ──► n8n /webhook/invoice-assistant (read-only agent, 6 tools)
                        decisions ──► decideInvoice: stage change + note (approve only from Ready to approve)
   /app/suppliers, /app/purchase-orders, /app/team (desk admins), /app/rules (read-only), /app/overview
   Reset demo ──► resetDemo (demo account and admins only): archives visitor invoices, restores the 6 samples
```

The principle "the LLM proposes, the rules decide" is respected on both paths: in the invoice worker the LLM only extracts fields and the `Apply Rules` code node decides the stage; in the order portal `placeOrder` applies deterministic TypeScript rules. The rules the reviewer sees in the app (`src/lib/invoice-rules.ts`) mirror `Apply Rules`; the duplication is tracked as BUGS B-10.

The order flow (earlier scenario):

```
Client (browser, Supabase login)
   ├─ "Order assistant" chat ──► server fn sendChat ──► n8n webhook /order-assistant  (LLM, flow not in the repo)
   ├─ Inventory (listInventory ◄── HubSpot products) ──► cart (sessionStorage)
   ▼
Cart ──► server fn placeOrder: access check, re-reads products from HubSpot, src/lib/order-rules.ts
         (whole packs, min. packs, stock, delivery date, overdue payment, negotiated list),
         deal + line items in the "Orders" pipeline, offer email via n8n /app-order-offer if ready/waiting
```

Platform area for AppBuilder.ai staff: `/app/platform` (client portals, users & roles, revenue dashboard). Landing: `/` ("Try the demo" opens the invoice desk demo; contact form → HubSpot Forms API).

## 2. Architecture

| Layer | Technology (from the code) | Role |
|---|---|---|
| Framework | **TanStack Start** (React 19, file-based TanStack Router, server functions) on **Vite 8**; build with `@lovable.dev/vite-tanstack-config` + Nitro (default target Cloudflare) | SSR + server RPC |
| UI | Tailwind 4, shadcn/ui (Radix), lucide, sonner, recharts | landing, invoice desk, order portal, platform |
| Client data | `@tanstack/react-query`, `zod` for validating server fn input | |
| Auth | **Supabase Auth** (email+password; two demo accounts through magic-link tokens generated server-side with the service role) | login, demo |
| Supabase DB | a single table: `public.user_roles` (+ enum `app_role`: `admin`, `user`, `ap_reviewer`, `client_admin`; the `has_role` function) | roles |
| "The bank's system" / the business data | **HubSpot** (portal 149650024): companies (suppliers and casings clients), contacts, deals (pipelines "Procure-to-pay" and "Orders"), line items, notes, products | source of truth for suppliers, POs, invoices, catalogue, orders |
| Orchestration / agents | **n8n cloud** (`revtech-agency.app.n8n.cloud`). Invoices: 3 workflows, exported in `n8n/invoice-worker/`. Orders: 6 workflows, ⚠️ not in the repo | |
| LLM | **Claude `claude-sonnet-5-5`** through n8n's Anthropic Chat Model node: the Information Extractor in "Process supplier invoices" and the agent in "Invoice assistant chat" (from the export). The app never calls an LLM directly. ⚠️ The model of the order flows isn't verifiable from the repo (D3) | |
| Banking mock | doesn't exist | |
| Tests | Vitest + jsdom + Testing Library: 5 files, 53 tests. n8n invoice worker: 12 cases run against the live webhook by `n8n/invoice-worker/run-tests.mjs` | |
| CI | doesn't exist (`.github/` is missing) | |

### Repo structure (actual)

```
src/
  routes/            file = route (TanStack). /, /login, /customer-form, /app (layout)
    app/invoices/    index (queue), $invoiceId (detail + decisions), new (submit document)
    app/             overview, suppliers, purchase-orders, team, rules (invoice desk);
                     $companyId/{orders,new-order,inventory} (order portal); dashboard, admin
    app/platform/    clients, users, dashboard (AppBuilder.ai staff)
  lib/
    invoice-rules.ts the invoice desk rules (pure, tested): stage IDs, approval limits, checks,
                     anomaly labels, suggested decision comments, demo history
    invoices.ts      server fns: listInvoices, getInvoice, listSuppliers, listPurchaseOrders,
                     submitDocument, decideInvoice, askAssistant, resetDemo
    back-office.ts   server fns: purchase orders, suppliers, users & roles, the client's team
    order-rules.ts   the order rules (pure, tested) + HubSpot pipeline/stage IDs
    orders.ts        server fns: getMyCompanies, listOrders, listInventory, sendChat, placeOrder
    billing.ts       revenue model (subscription + fee/order), pure, tested
    dashboard.ts     server fn getPlatformDashboard (admin)
    admin.ts         roles, role middleware, default role on first sign-in, demo sign-ins
    demo-guide.ts    the step-by-step guide for the invoice desk demo account
    hubspot.server.ts  HubSpot + n8n HTTP clients (server only)
    auth.tsx, cart.tsx, format.ts, error-*.ts
  integrations/supabase/   files generated by Lovable (client, client.server, auth-middleware, types)
  components/        UI (ui/ = shadcn; invoice-bits, p2p-overview, demo-guide, app-sidebar, …)
  test/              5 test files
n8n/invoice-worker/  the 3 invoice workflows (JSON), test-cases.json (12 cases), run-tests.mjs, README
evidence/            invoice-worker-run-2026-10-29.md (12/12 on 4 runs)
prompts/             lovable/lovable-prompts.md, n8n/n8n-prompt.md (the build prompts)
scripts/hubspot/     setup.ts (orders), setup-invoices.ts (invoices), check-ids.ts (read-only ID check)
                     + data/{catalogue,demo-orders,live-messages}.json, data/invoices/{invoices,live-messages}.json
drizzle/             migrations/0000_create_user_roles.sql, 0001_add_ap_reviewer_role.sql,
                     0002_add_client_admin_role.sql (schema.ts is empty)
supabase/config.toml project_id only
```

These still don't exist (compared with the "target structure" in the draft): `/agents`, `/rules` (as a shared rules file), `/data/synthetic`, `supabase/migrations/` (on purpose, see B-07).

### Contracts between components

- **App → n8n `invoice-intake`** (`submitDocument`): `{source_id, text, pdf_base64, filename, submitted_by}` → `{deal_id, stage, stage_label, document_type, supplier_name, invoice_number, amount, match_result, approval_level, anomaly_flags, exception_reason, lines[], supplier_email_draft}`; header `x-appbuilder-key`. The worker stores `source_message_id = "app-" + source_id`; a repeated `source_id` returns the existing deal.
- **App → n8n `invoice-assistant`** (`askAssistant`): `{session_id, message, invoice_deal_id, user_email}` → `{reply}` (or `{output}`).
- **App → n8n `order-assistant`** (`sendChat`): `{session_id, client_name, negotiated_skus[], message, cart[]}` → `{reply, delivery_date?, cart: ChatCartLine[]}`.
- **App → n8n `app-order-offer`** (`placeOrder`): `{deal_id, token, to, client_name, order_ref, delivery_date, intro, line_item_ids[], lines[]}`.
- **HubSpot "Procure-to-pay" pipeline** (ID `default`): PO open → PO partly received → PO fully received → PO closed (purchase orders), and Received → Waiting on supplier → Needs review → Ready to approve → Approved for payment; Duplicate, Rejected (invoices). POs and invoices are told apart by `document_type`. Properties in the group `appbuilder_invoice_worker` (defined in `scripts/hubspot/setup-invoices.ts`): on suppliers `supplier_status`, `supplier_vat_id`, `supplier_iban`, `previous_iban`, `iban_changed_on`, `tax_certificate_valid_until`; on deals `po_number`, `budget_code`, `po_requester`, `document_type`, `invoice_number`, `invoice_date`, `due_date`, `iban_on_invoice`, `vat_amount`, `match_result`, `approval_level`, `anomaly_flags`, `approved_by`; on line items `received_quantity`, `delivery_note_ref`, `po_line_ref`, `line_check`, `line_check_note`.
- **HubSpot "Orders" pipeline**: Received → Waiting on client → Needs staff → Ready to confirm → Confirmed; Duplicate, Rejected. Custom properties in the group `appbuilder_order_worker` (defined in `scripts/hubspot/setup.ts`): `delivery_date`, `order_channel` (email/whatsapp/pdf/app), `source_message_id`, `raw_order_text`, `exception_reason`, `min_field_confidence`; on line items `client_code_as_written`, `rounding_note`, `field_confidence`; on companies `payment_status`, `negotiated_skus`, `appbuilder_*`; on products `pack_type`, `units_per_pack`, `min_sale_packs`, `stock_packs`. Invoices reuse `exception_reason`, `source_message_id`, `raw_order_text`, `order_channel` and `min_field_confidence`.

### Roles

| Role | Who | Can |
|---|---|---|
| `ap_reviewer` | the bank's AP reviewers, added by a desk admin on the Team page after they sign up (new accounts get no role) | the invoice desk: queue, invoice page, decisions, submit document, chat |
| `client_admin` | the bank's desk admins | the above + suppliers, purchase orders, the team |
| `admin` | AppBuilder.ai staff | everything, including the platform area, users & roles and Reset demo |
| (demo account `DEMO_AP_EMAIL`) | visitors who click Try the demo | `ap_reviewer` + Reset demo (only this account and admins can reset) |
| (no role) | casings clients, matched by confirmed email domain; new accounts until an admin adds them | casings clients: their company's orders in the order portal; others: a message to ask their desk admin |

## 3. Local install

```bash
git clone https://github.com/revtech-agency/app-builder-ai
cd app-builder-ai
bun install                  # the repo uses bun.lock
cp .env.example .env.local   # fill it in (see below)
bun run dev
bun run test
bun run build
```

The scripts in `scripts/hubspot/` require **Bun** (they use `Bun.sleep`, `import.meta.dir`); bun loads `.env.local` on its own.

### Environment variables (names only)

| Variable | Where it's read | Required | Notes |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server (middleware, SSR) | yes | |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | yes | |
| `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_PROJECT_ID` | only in `.env` | no | informational |
| `SUPABASE_SERVICE_ROLE_KEY` | server (`client.server.ts`) | yes (roles, demo, user list) | **missing from `.env.example`** |
| `HUBSPOT_ACCESS_TOKEN` | server (`hubspot.server.ts`), `scripts/hubspot/*.ts`, `n8n/invoice-worker/run-tests.mjs` | yes (everything that reads HubSpot) | in `.env.example` since 2026-10-29 |
| `N8N_APP_KEY` | server | yes for submitting documents, the invoice chat, the order chat and the offer email | **missing from `.env.example`** |
| `DEMO_EMAIL` | server | no (default `demo@appbuilder.ai`) | the casings demo account |
| `DEMO_AP_EMAIL` | server | no (default `ap-demo@appbuilder.ai`) | the invoice desk demo account; must have the `ap_reviewer` role |
| `DEMO_ENABLED` | server | no (default off) | `true` opens the public one-click demo ("Try the demo"). Anything else closes it: both demo sign-ins refuse, the demo accounts' existing sessions lose access to the invoice desk and the order portal, and the landing page shows "Book a demo" |
| `INVOICE_APP_KEY` | `n8n/invoice-worker/run-tests.mjs` | for the test run | the same value as `N8N_APP_KEY` |
| `N8N_BASE_URL` | `n8n/invoice-worker/run-tests.mjs` | no (default `https://revtech-agency.app.n8n.cloud`) | |
| `HUBSPOT_API_KEY` | `scripts/hubspot/*.ts`, `n8n/invoice-worker/run-tests.mjs` | no | old name for the same token; read only if `HUBSPOT_ACCESS_TOKEN` is missing |
| `LOVABLE_DB_MIGRATION_URL` | `drizzle.config.ts` | no | |
| `LOVABLE_CRON_SECRET`(`_PREVIOUS`) | `cron-auth.ts` | no | no scheduled job uses it |

There's no `LLM_API_KEY`/`MODEL` in the app: the Anthropic credential lives in n8n ("RTA Anthropic API"). The contact form IDs are constants in `src/components/contact-form.tsx` (public).

### The database and HubSpot

```bash
bun scripts/hubspot/setup-invoices.ts --dry-run   # reads only
bun scripts/hubspot/setup-invoices.ts             # properties, Procure-to-pay pipeline, 6 suppliers, 10 POs, 6 history invoices
bun scripts/hubspot/setup.ts --dry-run            # orders: reads only
bun scripts/hubspot/setup.ts                      # orders: properties, pipeline, 180 products, 4 demo clients, 12 orders
bun scripts/hubspot/setup.ts --history-only       # orders: 6 confirmed orders; the rest in data/live-messages.json
bun scripts/hubspot/check-ids.ts                  # reads only: the hardcoded stage IDs still match the portal
```
The portal must have EUR as its currency. The setup scripts are idempotent. The 10 live invoice documents for a live run, each with its expected stage, are in `scripts/hubspot/data/invoices/live-messages.json`.

The n8n workflows are imported from `n8n/invoice-worker/*.json`; their README lists the import steps, the credentials and how the export differs from the original brief. ⚠️ The export is older than the live version (`030f7e0f…`): live, the split purchase rule counts only invoices on the same PO.

Supabase: **the only source of the schema is `drizzle/migrations/`** (`0000_create_user_roles.sql`: the `app_role` enum, the `user_roles` table with RLS, the `has_role` function; `0001` and `0002` add the `ap_reviewer` and `client_admin` roles). It's changed through Lovable database prompts, which add a new migration here; `src/integrations/supabase/types.ts` is regenerated from the real database and isn't edited by hand. `drizzle/schema.ts` is empty on purpose. `supabase/migrations/` must not be created (see BUGS B-07).

⚠️ The pipeline/stage IDs and the demo company (`458454559952`) are hardcoded for portal 149650024; on another portal they have to be replaced (`invoice-rules.ts`, `order-rules.ts`, `orders.ts`, and the `Apply Rules` node in n8n). `check-ids.ts` shows which ones differ.

## 4. How to test

```bash
bun run test        # vitest: invoice-rules (17), app-routing (15), order-rules (10), billing (8), demo-guide (3)
INVOICE_APP_KEY=… HUBSPOT_ACCESS_TOKEN=… node n8n/invoice-worker/run-tests.mjs   # 12 invoice cases against the live worker
```

The invoice runner posts the 12 cases in `n8n/invoice-worker/test-cases.json` to `/webhook/invoice-intake`, compares the stage, flags, match result and document type with the expected ones, and archives the invoices it created afterwards (`--keep` leaves them). Latest result: **12 of 12 correct on 4 runs in a row**, see `evidence/invoice-worker-run-2026-10-29.md`. There are still no tests for the server functions (`placeOrder`, `visibleCompanies`, `decideInvoice`, `resetDemo`).

### The demo scenario (invoice desk)

1. Set `DEMO_ENABLED=true` in the deploy settings (the public demo has been closed since the hackathon ended), then open https://nexxt.appbuilder.ai and click **Try the demo** → signs in as `DEMO_AP_EMAIL` (an `ap_reviewer`, not an admin) and opens the invoice desk. A step-by-step guide follows these steps.
2. **Submit a sample invoice** (`/app/invoices/new`, text or PDF) → the worker returns the stage, the flags and the reason.
3. **Open the invoice** → three-way match per line, every check passed or failed, the supplier's IBAN and certificate, the audit note.
4. **Ask the worker** → the read-only chat answers from HubSpot.
5. **Make the decision** → approve (only from Ready to approve), send back, reject or mark a duplicate; the comment starts from the failed checks and is saved as a note.
6. **Reset the demo** → archives the invoices visitors created and restores the 6 sample invoices.

The casings order portal still has its own demo account (`DEMO_EMAIL`, sees only the demo company `458454559952`): **New order** → "MB52-T 3000 m, delivery Thursday" → **Place order** → the deal with its stage and `exception_reason` in **Orders**.

### Test cases

- Invoices: the 12 cases in `n8n/invoice-worker/test-cases.json` (clean match, price off, quantity over delivery, expired certificate, duplicate, IBAN mismatch, IBAN changed recently, supplier not approved, unknown supplier, no PO, split purchase, supplier question), run automatically.
- Orders: `scripts/hubspot/data/demo-orders.json` / `live-messages.json` contain 12 orders with the expected result (stage + exception), e.g. a quantity that doesn't fill packs (ORD-1008 → Waiting on client), unknown client code F45 (ORD-1009 → Needs staff), client in arrears (ORD-1010 → Needs staff). Not run automatically.

## 5. Business rules

### Invoices (n8n `Apply Rules`; the checks, stages and approval limits are mirrored in `src/lib/invoice-rules.ts`, tested)

| ID | Condition | Result |
|---|---|---|
| R-I01 | an invoice with the same number from the same supplier already exists | Duplicate |
| R-I02 | supplier unknown, blocked or not approved (`supplier_status`) | Needs review |
| R-I03 | the IBAN on the invoice differs from `supplier_iban` | Needs review (`iban_mismatch`) |
| R-I04 | the supplier's IBAN changed within 30 days of the invoice date | Needs review (`iban_recently_changed`) |
| R-I05 | 2+ invoices from the window within 14 days, each ≤ 5,000 EUR, together > 5,000 EUR (live: on the same PO) | Needs review (`split_purchase`) |
| R-I06 | field confidence < 0.8 | Needs review (`low_confidence`) |
| R-I07 | a line's price is more than 2% off the PO price | Needs review (`price_off`) |
| R-I08 | a line's quantity is above what the delivery notes show as received | Waiting on supplier (`qty_off`) |
| R-I09 | a line isn't on the PO | Needs review (`not_on_po`) |
| R-I10 | no PO number on the invoice, or the PO isn't found | Waiting on supplier (`no_po`) |
| R-I11 | the tax certificate is expired or missing | Waiting on supplier (`certificate_expired`) |
| R-I12 | a supplier question, or a document that isn't an invoice, credit note or reminder | Needs review, with a summary as the note |
| R-I13 | a payment reminder for an invoice that isn't in the system (a reminder that matches an invoice passes) | Needs review |
| R-I14 | the invoice's stage = the worst result: duplicate > needs review > waiting on supplier > ready to approve | |
| R-I15 | approval level from the total: ≤ 5,000 team lead, ≤ 25,000 head of department, above that the CFO | `approval_level` (shown; ⚠️ not enforced on approval) |
| R-I16 | only an invoice in Ready to approve can be approved; Approved, Rejected and Duplicate are final | enforced in `decideInvoice` |

### Orders (`src/lib/order-rules.ts`, tested)

| ID | Condition | Action |
|---|---|---|
| R-01 | the quantity in metres doesn't divide exactly into packs | round up to whole packs + `rounding_note`; stage ≥ Waiting on client |
| R-02 | packs < `min_sale_packs` | raised to the minimum; Waiting on client |
| R-03 | `stock_packs` < packs requested | note "only N in stock"; Waiting on client |
| R-04 | no delivery date | Waiting on client |
| R-05 | `payment_status = overdue` | Needs staff; no offer email |
| R-06 | SKU outside `negotiated_skus` (if the list isn't empty) | order rejected with an error |
| R-07 | product without `units_per_pack` | error |
| R-08 | the order's stage = the worst stage among the lines/conditions (ready < waiting < staff) | |

Only in the order demo data / n8n, **not verifiable in the code** (⚠️ confirm they exist in the flow): matching on the client's code map, the closest product by family+calibre+colour, duplicate detection on `source_message_id`, finance alert for a client in arrears, minimum confidence per field.

Billing (`src/lib/billing.ts`): monthly subscription from the start month + a fee per billable order (any stage except Duplicate/Rejected); demo: 99 EUR + 0.60 EUR/order.

## 6. Known limitations

- The order worker's 6 n8n flows and their prompts aren't in the repo; the invoice worker's are (`n8n/invoice-worker/`), but the export is older than the live version.
- The invoice rules exist twice: in the n8n `Apply Rules` node and in `invoice-rules.ts` (B-10).
- The demo account is shared, so one visitor's Reset demo removes the invoices another visitor submitted (B-21; new accounts no longer get access on their own).
- The approval level isn't enforced: any reviewer can approve a CFO-level invoice (R-I15).
- Send back doesn't email the supplier; it moves the stage and saves a note.
- No banking mock API; no separate orchestrator; the trace is the audit note, not a step-by-step timeline.
- Stock isn't decreased when an order is placed (B-09).
- 100% synthetic data (suppliers and clients "(demo)", `example.com`, made-up IBANs, prices and stock).
- Details: BUGS.md.

## 7. The team

⚠️ name · role · contact (see STATUS.md).
