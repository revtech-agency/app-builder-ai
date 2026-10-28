# Supplier invoice worker (n8n workflows)

Three importable n8n workflows for the banking demo: an AP worker that does a three-way match
(PO, delivery, invoice) and sends each invoice to the right HubSpot stage. All three are tagged
`appbuilder` and `invoice-worker` and are saved **inactive**.

| File | Workflow | Entry |
| --- | --- | --- |
| `1-process-supplier-invoices.json` | Process supplier invoices | Gmail trigger (`to:demo+invoices@appbuilder.ai is:unread`) and `POST /webhook/invoice-intake` |
| `2-invoice-assistant-chat.json` | Invoice assistant chat | `POST /webhook/invoice-assistant` |
| `3-look-up-purchase-order.json` | Look up purchase order | Called by workflow 2 as a tool |

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
| Order | Order assistant chat | `IhNhsoxf7x1a4Eys` | Active | `POST /webhook/order-assistant` (app) |
| Order | Send offer for app order | `1PSXF6gMFLxl1oJH` | Active | `POST /webhook/app-order-offer` (app) |
| Order | Process order emails | `cb1oRwq7IPuFlACQ` | Active | Gmail trigger (`to:demo+orders@appbuilder.ai is:unread`) |
| Order | Send order offer (HubSpot quote) | `h9Su42x12qcL022z` | Active | Sub-workflow of the two above |
| Order | Look up casing catalogue | `d7YevuVNRq6Sx9s3` | Active | Tool for reading orders |
| Order | Approve order from offer link | `rujs7V5m4YWXzaqi` | Active | `/webhook/order-approval` (link in the offer email) |
| Order | Send order offer | `LhA7BRoC6tkibSFI` | Inactive | Older PDF version, no longer called |
| Sales | AI Sales Proposal - Webhook to HubSpot Quote | `ONXAlT74A1TlkOPv` | Inactive | Not used by the app |

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

These files were built and checked offline: the JSON parses, every connection points at a real node,
all code compiles, and the rules ran correctly on 15 mock cases. They have **not** been imported into n8n
or run against HubSpot. Check these first:

- Line-item properties (`received_quantity`, `delivery_note_ref`, `po_line_ref`, `line_check`,
  `line_check_note`, `field_confidence`) exist in HubSpot. The connector that checked HubSpot could not read them.
- The options on `anomaly_flags` include: `duplicate`, `iban_mismatch`, `iban_recently_changed`,
  `unknown_supplier`, `supplier_blocked`, `split_purchase`, `low_confidence`, `certificate_expired`.
  HubSpot rejects values that are not options.
- The `order_channel` options include `email` and `app`.
- Respond to Webhook behaves quietly when the run started from the Gmail trigger.
- Node versions match your n8n version (the nodes were written from memory of the current node set).
- The expected-versus-actual run has not been done yet (see below).

## Test set

`test-cases.json` holds 12 synthetic documents written against the suppliers, POs and invoices that are
in the HubSpot portal now, each with its expected stage and flags. `run-tests.mjs` posts them to
`/webhook/invoice-intake` and prints a pass/fail table:

```sh
INVOICE_APP_KEY=<the AppBuilder app key value> node n8n/invoice-worker/run-tests.mjs
```

Add `--test` for n8n's test webhook, `--only 05-duplicate` for one case, or `--suffix -2` to rerun under
new source IDs (a repeated ID returns the deal that already exists). Each run creates real deals in HubSpot.

Eight cases (duplicate, IBAN mismatch, recent IBAN change, unapproved supplier, unknown supplier, no PO,
split purchase, supplier question) can run as they are. Cases 01 to 04 (clean match, price off, quantity over
delivery, expired certificate) need real PO line data, which could not be read from HubSpot, so they contain
`<FILL FROM PO LINES>` placeholders and the runner skips them until you fill them in from the PO deals named
in each case's `needs_po_lines` field.
