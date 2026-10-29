# Supplier invoice worker (n8n workflows)

Four importable n8n workflows for the banking demo: an AP worker that does a three-way match
(PO, delivery, invoice) and sends each invoice to the right HubSpot stage. All three are tagged
`appbuilder` and `invoice-worker` and are imported and active in n8n (see [Live in n8n](#live-in-n8n)).

| File | Workflow | Entry |
| --- | --- | --- |
| `1-process-supplier-invoices.json` | Process supplier invoices | Gmail trigger (demo+invoices@appbuilder.ai and daniel@tigros.io, see [Email intake](#email-intake)) and `POST /webhook/invoice-intake` |
| `2-invoice-assistant-chat.json` | Invoice assistant chat | `POST /webhook/invoice-assistant` |
| `3-look-up-purchase-order.json` | Look up purchase order | Called by workflow 2 as a tool |
| `4-send-demo-invoice-email.json` | Send demo invoice email | `POST /webhook/invoice-demo-send` (app, Email intake page) |

## Live in n8n

All AppBuilder workflows live in the
[01-AppBuilderAI](https://revtech-agency.app.n8n.cloud/projects/LZoZHxCNLl9iD0EU/folders/t5PMIeVchFarBmhr/workflows)
folder on revtech-agency.app.n8n.cloud. Open one at `https://revtech-agency.app.n8n.cloud/workflow/<ID>`.
IDs and status as of 2026-10-28.

| Worker | Workflow | ID | Status | Entry |
| --- | --- | --- | --- | --- |
| Invoice | Process supplier invoices | `Kxhmr00uS4MBXTSO` | Active | Gmail trigger and `POST /webhook/invoice-intake` (app) |
| Invoice | Invoice assistant chat | `HI8tvI2HG70NlgPo` | Active | `POST /webhook/invoice-assistant` (app) |
| Invoice | Look up purchase order | `rc72KPALhtJhwLZm` | Active | Tool for the invoice assistant |
| Invoice | Send demo invoice email | not imported yet | — | `POST /webhook/invoice-demo-send` (app) |
| Order | Order assistant chat | `IhNhsoxf7x1a4Eys` | Active | `POST /webhook/order-assistant` (app) |
| Order | Send offer for app order | `1PSXF6gMFLxl1oJH` | Active | `POST /webhook/app-order-offer` (app) |
| Order | Process order emails | `cb1oRwq7IPuFlACQ` | Active | Gmail trigger (`to:demo+orders@appbuilder.ai is:unread`) |
| Order | Send order offer (HubSpot quote) | `h9Su42x12qcL022z` | Active | Sub-workflow of the two above |
| Order | Look up casing catalogue | `d7YevuVNRq6Sx9s3` | Active | Tool for reading orders |
| Order | Approve order from offer link | `rujs7V5m4YWXzaqi` | Active | `/webhook/order-approval` (link in the offer email) |
| Order | Send order offer | `LhA7BRoC6tkibSFI` | Inactive | Older PDF version, no longer called |
| Sales | AI Sales Proposal - Webhook to HubSpot Quote | `ONXAlT74A1TlkOPv` | Inactive | Not used by the app |

## Email intake

Workflow 1 reads two mailboxes through the "DaniS TMT Gmail" credential (the daniel@tigros.io
account; demo+invoices@appbuilder.ai is delivered to it). Gmail query:

```text
{(to:demo+invoices@appbuilder.ai is:unread) (to:daniel@tigros.io {filename:pdf subject:invoice subject:factura})} -"Sent by the AppBuilder.ai invoice worker"
```

| Mailbox | Picks up | Result email to | After reading |
| --- | --- | --- | --- |
| daniel@tigros.io | a PDF attached, or "invoice"/"factura" in the subject | daniel@tigros.io | left unread (working inbox) |
| demo+invoices@appbuilder.ai | every unread email | daniel@tigros.io | marked read |

The list lives in the `Prepare Email` node and in `INTAKE_MAILBOXES` (`src/lib/intake.ts`, shown on
the app's Email intake page); `src/test/email-intake.test.ts` fails if the two disagree.

For every email-channel invoice it creates, the workflow now also:

1. stores `email_from`, `email_subject` and `email_received_by` on the deal;
2. emails the recipient (`Notify recipient?` → `Build Notification` → `Send Recipient Notification`):
   the result, what to do next (approve and by whom, which checks failed, what the supplier still
   has to send and whether they were already asked, or "do not pay twice"), every check with ✓/✗,
   the lines, and a link to the invoice in the app;
3. records `notified_to` and `notified_at` on the deal (`Record Notification`). A Gmail error does
   not stop the run; the deal then shows "not sent (Gmail error)".

Every email the workflow sends (result emails and the supplier "information needed" email) ends with
"Sent by the AppBuilder.ai invoice worker". The Gmail query excludes that phrase and `Prepare Email`
drops anything containing it, so the workflow never reads its own mail back in (both mailboxes are
the same Gmail account, and the demo emails are sent from it to itself).

Workflow 4 sends a demo invoice (`demo-invoices/` at the repo root, built from `test-cases.json`)
to a monitored mailbox, with the PDF attached, so it goes through the Gmail trigger like a
supplier's email. It refuses any recipient that is not a monitored mailbox.

### Deploying this change

Order matters: workflow 1 writes five new deal properties, and HubSpot rejects the whole deal if a
property doesn't exist.

1. Create the properties (reads the token from `.env.local`, touches nothing else):
   `bun scripts/hubspot/setup-invoices.ts --properties-only`. New deal properties: `email_from`,
   `email_subject`, `email_received_by`, `notified_to`, `notified_at`.
2. In n8n, update "Process supplier invoices" (`Kxhmr00uS4MBXTSO`) from
   `1-process-supplier-invoices.json`. Changed: `Gmail Trigger` (query), `Prepare Email` (now runs
   once for all items), `Prepare App Request`, `Build Document Text`, `Apply Rules` (three deal
   properties and four output fields added; the rules themselves are unchanged), `Send Supplier
   Email` (footer), `Email channel?` (marks read only where configured). New: `Notify recipient?`,
   `Build Notification`, `Send Recipient Notification`, `Record Notification`, between
   `Create Audit Note` and `Send supplier email?`.
3. Import `4-send-demo-invoice-email.json` and publish it. Credentials: "AppBuilder app key" on the
   webhook, "DaniS TMT Gmail" on both Gmail nodes.
4. Test: on the app's Email intake page, send "Clean match". Within about two minutes it should show
   as Ready to approve, and daniel@tigros.io should get "AppBuilder invoice check: Ready to approve
   · Invoice OS-2026-1301 · Office Supplies Demo SRL". Then send "Tax certificate expired": the
   result email says what is missing, and a supplier "information needed" email also arrives at
   daniel@tigros.io (the demo's sender).

Not verified yet (no n8n access when this was written): the Gmail query's nested `{ }` / `( )`
grouping, the Gmail node's `attachmentsUi` option on workflow 4, and how the Gmail trigger handles
mail sent from the account to itself.

## Import

1. Import workflow **3** first (n8n: Workflows, menu, Import from file). Copy its workflow ID from the URL.
2. Import workflow **2**, open the `get_purchase_order` tool node and replace
   `REPLACE_WITH_LOOK_UP_PURCHASE_ORDER_WORKFLOW_ID` with that ID.
3. Import workflow **1**.
4. In every workflow, pick the credentials on the nodes that show a warning:

   | Node type | Credential |
   | --- | --- |
   | HubSpot HTTP nodes | AppBuilder HubSpot Service Key (HubSpot app token) |
   | Anthropic Chat Model | RTA Anthropic API (model `claude-sonnet-5-5`) |
   | Gmail nodes | DaniS TMT Gmail |
   | Webhooks | AppBuilder app key (Header Auth, header `x-appbuilder-key`) |

5. If the tags did not import, add `appbuilder` and `invoice-worker` by hand.
6. Run a test, then publish when ready.

## How it differs from the original brief

- **One HubSpot pipeline.** The portal has a single "Procure-to-pay" pipeline (`default`). POs and
  invoices are told apart by `document_type` (`purchase_order` or `invoice`), and the stage IDs are hardcoded
  at the top of the `Apply Rules` code node.
- **Information Extractor** reads the document instead of an AI Agent, with PDFs converted to text first
  (Extract From File). Scanned image-only PDFs will not read.
- **HubSpot calls** are HTTP Request nodes using the HubSpot app-token credential, not the HubSpot node.
- **Supplier email** goes back to the sender of the email (the suppliers have no email field).
- **Split purchase** uses 5,000 EUR as the approval limit (the team-lead tier).
- **Line items** are found with the `associations.deal` search filter.

## Rules (in the `Apply Rules` node)

Worst stage wins: duplicate, then needs review, then waiting on supplier, then ready to approve.
Duplicate invoice number, IBAN mismatch, IBAN changed within 30 days, unknown or unapproved supplier,
split purchase, confidence under 0.8, line not on PO, price more than 2% off, quantity above what was
received, no PO, and an expired or missing tax certificate. The approval level comes from the total:
up to 5,000 team lead, up to 25,000 head of department, above that the CFO.

## Not verified against the live accounts

Checked against portal 149650024 on 2026-10-28: the line-item properties, anomaly_flags options and order_channel options exist.

The expected-versus-actual run is done: 12 of 12 cases correct on 2026-10-29, see
[`evidence/invoice-worker-run-2026-10-29.md`](../../evidence/invoice-worker-run-2026-10-29.md).

These files were built and checked offline: the JSON parses, every connection points at a real node,
all code compiles, and the rules ran correctly on 15 mock cases. They are now imported and active in n8n,
but these points have not been confirmed yet:

- Respond to Webhook behaves quietly when the run started from the Gmail trigger.
- Node versions match your n8n version (the nodes were written from memory of the current node set).

## Test set

`test-cases.json` holds 12 synthetic documents written against the suppliers, POs and invoices that are
in the HubSpot portal now, each with its expected stage and flags. `run-tests.mjs` posts them to
`/webhook/invoice-intake` and prints a pass/fail table:

```sh
INVOICE_APP_KEY=<the AppBuilder app key value> HUBSPOT_ACCESS_TOKEN=<private app token> node n8n/invoice-worker/run-tests.mjs
```

Add `--test` for n8n's test webhook, `--only 05-duplicate` for one case, or `--suffix -2` to rerun under
new source IDs (a repeated ID returns the deal that already exists). Each run creates real deals in HubSpot
and archives them, with their line items and notes, at the end; `--keep` leaves them in place.

All 12 cases run. Cases 01 and 02 use Office Supplies PO-2026-0444 so they don't interfere with the
split-purchase case on PO-2026-0440. Every case uses 21% VAT, like the sample invoices. Latest run:
[`evidence/invoice-worker-run-2026-10-29.md`](../../evidence/invoice-worker-run-2026-10-29.md).
