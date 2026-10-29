# Supplier invoice worker (n8n workflows)

Four importable n8n workflows for the banking demo: an AP worker that does a three-way match
(PO, delivery, invoice) and sends each invoice to the right HubSpot stage. All four are tagged
`appbuilder` and `invoice-worker` and are imported and active in n8n (see [Live in n8n](#live-in-n8n)).

| File | Workflow | Entry |
| --- | --- | --- |
| `1-process-supplier-invoices.json` | Process supplier invoices | Gmail trigger (daniel@tigros.io, its aliases daniel@appbuilder.ai and demo@appbuilder.ai, and demo+invoices@appbuilder.ai; see [Email intake](#email-intake)) and `POST /webhook/invoice-intake` |
| `2-invoice-assistant-chat.json` | Invoice assistant chat | `POST /webhook/invoice-assistant` |
| `3-look-up-purchase-order.json` | Look up purchase order | Called by workflow 2 as a tool |
| `4-send-demo-invoice-email.json` | Send demo invoice email | `POST /webhook/invoice-demo-send` (app, Email intake page) |

## Live in n8n

All AppBuilder workflows live in the
[01-AppBuilderAI](https://revtech-agency.app.n8n.cloud/projects/LZoZHxCNLl9iD0EU/folders/t5PMIeVchFarBmhr/workflows)
folder on revtech-agency.app.n8n.cloud. Open one at `https://revtech-agency.app.n8n.cloud/workflow/<ID>`.
IDs and status as of 2026-10-28 (Send demo invoice email added 2026-10-29).

| Worker | Workflow | ID | Status | Entry |
| --- | --- | --- | --- | --- |
| Invoice | Process supplier invoices | `Kxhmr00uS4MBXTSO` | Active | Gmail trigger and `POST /webhook/invoice-intake` (app) |
| Invoice | Invoice assistant chat | `HI8tvI2HG70NlgPo` | Active | `POST /webhook/invoice-assistant` (app) |
| Invoice | Look up purchase order | `rc72KPALhtJhwLZm` | Active | Tool for the invoice assistant |
| Invoice | Send demo invoice email | `AaooGE5gsNiY6TDl` | Active | `POST /webhook/invoice-demo-send` (app) |
| Order | Order assistant chat | `IhNhsoxf7x1a4Eys` | Active | `POST /webhook/order-assistant` (app) |
| Order | Send offer for app order | `1PSXF6gMFLxl1oJH` | Active | `POST /webhook/app-order-offer` (app) |
| Order | Process order emails | `cb1oRwq7IPuFlACQ` | Active | Gmail trigger (`to:demo+orders@appbuilder.ai is:unread`) |
| Order | Send order offer (HubSpot quote) | `h9Su42x12qcL022z` | Active | Sub-workflow of the two above |
| Order | Look up casing catalogue | `d7YevuVNRq6Sx9s3` | Active | Tool for reading orders |
| Order | Approve order from offer link | `rujs7V5m4YWXzaqi` | Active | `/webhook/order-approval` (link in the offer email) |
| Order | Send order offer | `LhA7BRoC6tkibSFI` | Inactive | Older PDF version, no longer called |
| Sales | AI Sales Proposal - Webhook to HubSpot Quote | `ONXAlT74A1TlkOPv` | Inactive | Not used by the app |

Live versions of the email-intake workflows on 2026-10-29:

| Workflow | Live version | Rollback |
| --- | --- | --- |
| Process supplier invoices (`Kxhmr00uS4MBXTSO`) | `8a6fc862-ad16-47e5-b8dc-62d679784e71` (e-Factura channel and the money line) | before the e-Factura channel: `f2cb7cbd-ad89-4d0f-8617-62327a4afd29` (node groups added; same logic as `0de20bcf-5af9-459f-914d-4e2c898a3a1c`); before the node groups: `0de20bcf-5af9-459f-914d-4e2c898a3a1c`; before the duplicate fixes: `fa781b6c-1fb2-4760-9059-e8846db2221b`; before email intake: `030f7e0f-07b6-42ca-8620-61525f0ce617` |
| Send demo invoice email (`AaooGE5gsNiY6TDl`) | `13fa122f-d8ee-43b4-a381-a987f0a2a199` | before the aliases: `b677106d-3814-4a34-a867-ac6e5e4559e3` |

## Email intake

Workflow 1 reads four addresses through the "DaniS TMT Gmail" credential (the daniel@tigros.io
account; daniel@appbuilder.ai, demo@appbuilder.ai and demo+invoices@appbuilder.ai are delivered to
it). Gmail query:

```text
{(to:demo+invoices@appbuilder.ai is:unread) (from:daniel@tigros.io {to:daniel@tigros.io to:daniel@appbuilder.ai to:demo@appbuilder.ai} {filename:pdf subject:invoice subject:factura})} -"Sent by the AppBuilder.ai invoice worker"
```

| Mailbox | Picks up | Result email to | After reading |
| --- | --- | --- | --- |
| daniel@tigros.io | only mail the account sends to itself (the demo sends), with a PDF attached or "invoice"/"factura" in the subject | daniel@tigros.io | left unread (working inbox) |
| daniel@appbuilder.ai | same as daniel@tigros.io (an alias of it) | daniel@tigros.io | left unread |
| demo@appbuilder.ai | same as daniel@tigros.io (an alias of it) | daniel@tigros.io | left unread |
| demo+invoices@appbuilder.ai | every unread email | daniel@tigros.io | marked read |

`from:daniel@tigros.io` keeps real mail to that inbox and its two aliases out for now: only the demo
sends (workflow 4, or mail you send yourself) become deals. To open the inbox to real supplier invoices, remove
`from:daniel@tigros.io` from the `Gmail Trigger` query, here and in n8n. Every matching email then
becomes a deal in the demo portal and gets a result email.

The list lives in the `Prepare Email` node and in `INTAKE_MAILBOXES` (`src/lib/intake.ts`, shown on
the app's Email intake page); `src/test/email-intake.test.ts` fails if the two disagree.

For every email-channel invoice it creates, the workflow now also:

1. stores `email_from`, `email_subject` and `email_received_by` on the deal (with `notified_to` and
   `notified_at` below, the five deal properties created on 2026-10-29 in portal 149650024 by
   `setup-invoices.ts --properties-only`, group `appbuilder_invoice_worker`);
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

Deployed on 2026-10-29 (steps 1–3, then the Clean match test of step 4 sent through the
`invoice-demo-send` webhook, since the Email intake page was not merged yet). Live n8n versions:
workflow 1 `3eb23400-8ead-46a1-9ea0-1b6083078774` (rollback: `030f7e0f-07b6-42ca-8620-61525f0ce617`,
the version before email intake), workflow 4 `b677106d-3814-4a34-a867-ac6e5e4559e3`. Workflow 1 was
updated in place, not re-imported, so its IDs and credentials did not change.

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

Verified in the 2026-10-29 deployment (Clean match, n8n executions 360 and 361, deal
`533365512404`): the Gmail query's nested `{ }` / `( )` grouping works; workflow 4 attaches the PDF
(`attachmentsUi`); mail the account sends to itself does trigger workflow 1; the result email
arrives at daniel@tigros.io, `notified_to` / `notified_at` are set, and the result email is not
read back in. The "Tax certificate expired" case of step 4 was not sent.

Aliases (added 2026-10-29, live workflow 1 `2317091d-b406-44b1-aa2e-26dec8fae19b`, rollback
`3eb23400-8ead-46a1-9ea0-1b6083078774`): demo sends to daniel@appbuilder.ai (execution 368, deal
`532708179160`) and demo@appbuilder.ai (execution 370, deal `533278345423`) were picked up, with
`email_received_by` set to the alias and the result email sent to daniel@tigros.io.

Several emails in one Gmail poll (fixed 2026-10-29, live workflow 1
`fa781b6c-1fb2-4760-9059-e8846db2221b`, rollback `2317091d-b406-44b1-aa2e-26dec8fae19b`): two emails
in the same poll used to give one deal (execution 368). `Match Supplier` ran once for all items,
read `$('Read Document').item` (always the first item in that mode) and returned one item. It and the
other Code nodes that read `$('Node').item` (`Collect PO`, `Apply Rules`, `Build Notification`,
`Build Response`, `Existing Response`) now run once per item; `src/test/email-intake.test.ts` fails
if a Code node that reads `$('Node').item` runs once for all items. Verified with two demo sends three
seconds apart: one run (execution 373), two deals (`533287231677`, `532716985571`), each checked
against its own PO and history. The app webhook path still passes (`run-tests.mjs --only
08-supplier-not-approved`).

Duplicates in one Gmail poll (fixed 2026-10-29, live workflow 1
`0de20bcf-5af9-459f-914d-4e2c898a3a1c`, rollback `fa781b6c-1fb2-4760-9059-e8846db2221b`):

- Two copies of one invoice in the same poll both became deals: the history search can't see a deal
  created earlier in the same run. `Match Supplier` now also outputs each email's
  `source_message_id` and invoice number, and `Apply Rules` marks an invoice Duplicate when an
  earlier email of the run has the same supplier and invoice number.
- Gmail returns the newest email first, so `Prepare Email` now passes a poll's emails on oldest
  first: the later copy is the duplicate.
- Several emails per run hit HubSpot's per-second search limit (429 in `Look Up History`, execution
  381, which failed the whole run). The five search nodes (`Find Existing`, `Fetch Suppliers`,
  `Look Up PO`, `Get PO Lines`, `Look Up History`) retry up to 4 times, 1.5 s apart. The create
  nodes don't retry, so a retry can't create a record twice.
- `Send Recipient Notification` and `Record Notification` now also have `onError:
  continueRegularOutput` live, as in this file; it was missed when they were first deployed.

Verified: "Clean match" sent twice three seconds apart gave one run (execution 384), the first copy
Ready to approve and the second Duplicate.

## e-Factura channel and the money line

Added on 2026-10-29 with the app's e-Factura intake page and its money figures:

- **e-Factura (simulated SPV).** The app's e-Factura intake page reads an RO e-Factura XML (a demo
  invoice from the simulated SPV inbox, or an uploaded XML), turns its fields into the worker's text
  layout and posts it to `POST /webhook/invoice-intake` with `channel: "efactura"` and
  `source_id: "efactura-<SPV id>"`. `Prepare App Request` keeps that channel (anything else from the
  app stays `app`), so the deal gets `order_channel = efactura` and the same 12 checks run. There is
  no live ANAF connection: that needs ANAF OAuth with the company's qualified certificate.
- **Money line in the result email.** `Build Notification` works out the money held before payment
  (duplicates, unverified payees, split purchases, no PO, overbilling per line from the PO lines in
  `Collect PO`) with the same rules as `src/lib/money.ts`, adds "Money protected: EUR X · reason" to
  the email and returns it as `money_held`. `src/test/email-intake.test.ts` runs the node against
  `src/lib/money.ts` on nine cases.

### Deploying the e-Factura channel

1. Add the `efactura` option to the deal property `order_channel`, or HubSpot rejects e-Factura
   deals: `bun scripts/hubspot/setup-invoices.ts --properties-only` (it now also adds missing
   options; nothing else changes).
2. In n8n, update "Process supplier invoices" (`Kxhmr00uS4MBXTSO`) from
   `1-process-supplier-invoices.json`. Changed: `Prepare App Request` and `Build Notification`.
   Nothing else.
3. Test: on e-Factura intake, take "Clean match" from the SPV inbox; it should come back Ready to
   approve and show as e-Factura in the queue's Source column. Then send "Price off" from Email
   intake: the result email should open with "Money protected: EUR 67.76 · Overbilling found"
   (50 boxes at EUR 13.52 against the PO's EUR 12.40: EUR 56.00 net, plus 21% VAT).

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
