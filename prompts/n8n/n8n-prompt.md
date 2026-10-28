# n8n prompt: supplier invoice worker (banking demo)

Paste the block below into the n8n builder or Claude with the n8n MCP, after filling the `<…>` IDs from `HUBSPOT.md` once the HubSpot setup has run.

---

Build three new workflows on revtech-agency.app.n8n.cloud for a banking demo: an AI worker that processes supplier invoices for a bank's accounts-payable team (PO → delivery note → invoice, a "three-way match" against procurement rules).

**Do not edit, deactivate or archive any existing workflow.** The casings order worker (`cb1oRwq7IPuFlACQ`, `IhNhsoxf7x1a4Eys`, `1PSXF6gMFLxl1oJH`, `h9Su42x12qcL022z`, `d7YevuVNRq6Sx9s3`, `rujs7V5m4YWXzaqi`) must keep working. You may **copy** nodes from `cb1oRwq7IPuFlACQ` "Process order emails" and `IhNhsoxf7x1a4Eys` "Order assistant chat": their structure is the model for the new flows. Tag the new workflows `appbuilder` and `invoice-worker`. Build them inactive; we publish after testing.

Reuse these credentials (don't create new ones): HubSpot calls "AppBuilder HubSpot Service Key" (HubSpot app token), model "RTA Anthropic API" with `claude-sonnet-5-5`, Gmail "DaniS TMT Gmail", webhooks Header Auth "AppBuilder app key" (header `x-appbuilder-key`).

## HubSpot (portal 149650024)

- Supplier invoices pipeline `<INVOICE_PIPELINE_ID>`. Stages: Received `<ID>`, Waiting on supplier `<ID>`, Needs review `<ID>`, Ready to approve `<ID>`, Approved for payment `<ID>`, Duplicate `<ID>`, Rejected `<ID>`.
- Purchase orders pipeline `<PO_PIPELINE_ID>`. Each PO is a deal with `po_number`, `budget_code`, `po_requester`, associated to the supplier company. PO line items carry `hs_sku`, `name`, `quantity` (ordered), `price` (agreed unit price), `received_quantity` (from delivery notes) and `delivery_note_ref`.
- Suppliers are companies with `supplier_status` set (`approved` / `pending_onboarding` / `blocked`), plus `supplier_vat_id`, `supplier_iban`, `previous_iban`, `iban_changed_on`, `tax_certificate_valid_until`.
- Invoice deal properties: `document_type`, `invoice_number`, `invoice_date`, `due_date`, `po_number`, `iban_on_invoice`, `vat_amount`, `match_result`, `approval_level`, `anomaly_flags` (multi-checkbox, values joined with `;`), `exception_reason`, `source_message_id`, `raw_order_text` (raw document text), `order_channel`, `min_field_confidence`.
- Invoice line item properties: `hs_sku`, `name`, `quantity`, `price`, `po_line_ref`, `line_check` (`matched` / `price_off` / `qty_off` / `not_on_po`), `line_check_note`, `field_confidence`.
- Association typeIds: deal→company 5, line_item→deal 20. Notes: create with `hs_note_body` + `hs_timestamp` and associate to the deal (note→deal 214).

## Workflow 1: "Process supplier invoices"

**Triggers** (both feed the same chain):
- Gmail Trigger: every minute, `to:demo+invoices@appbuilder.ai is:unread`, download attachments (PDF invoices). `source_message_id` = `gmail-<email id>`.
- Webhook POST `/webhook/invoice-intake` (Header Auth), body `{ source_id, filename?, pdf_base64?, text?, submitted_by }` from the app. `source_message_id` = `app-<source_id>`. Ends in Respond to Webhook with the result JSON (below).

**Chain:**
1. **Fetch suppliers** (once): companies search, `supplier_status HAS_PROPERTY`, properties above.
2. **Read document** (AI Agent, same setup as "Read Order", PDFs passed to the model). System prompt: you are the accounts-payable desk of a bank. First classify `document_type` (invoice / credit_note / reminder / question / other). For invoices and credit notes, extract: supplier name, VAT ID, IBAN, invoice number, invoice date, due date, PO number, currency, net, VAT, total, and lines (item code as written, description, quantity, unit price, line total), each with a 0–1 confidence. Identify the supplier from the known list (VAT ID first, then name); leave the ID empty if there's no credible match. For a question, write a 2-sentence summary. Never invent values: leave a field empty if it isn't on the document. Structured output with those fields.
3. **Look up PO**: if a PO number was found, deals search `po_number EQ <po>` in `<PO_PIPELINE_ID>`, then read its line items (`hs_sku`, `name`, `quantity`, `price`, `received_quantity`).
4. **Look up history**: invoice deals for the same supplier from the last 30 days (`invoice_number`, `amount`, `invoice_date`, `dealstage`), for the duplicate and split-purchase checks.
5. **Apply invoice rules** (Code node). Worst stage wins: duplicate > needs_review > waiting_on_supplier > ready_to_approve.
   - Same supplier + same `invoice_number` already exists and isn't Rejected → duplicate, flag `duplicate`.
   - `iban_on_invoice` ≠ supplier `supplier_iban` → needs_review, `iban_mismatch` ("IBAN on the invoice differs from the one on file. Verify by phone before paying.").
   - Supplier `iban_changed_on` within 30 days before `invoice_date` → needs_review, `iban_recently_changed`.
   - No supplier match → needs_review, `unknown_supplier`. `supplier_status` ≠ `approved` → needs_review, `supplier_blocked`.
   - Split purchase: same supplier, 2+ invoices within 14 days (this one included), each under an approval limit but together over it → needs_review, `split_purchase`.
   - Any confidence < 0.8 → needs_review, `low_confidence`.
   - Per line, match to a PO line by `hs_sku`, else by description: not on PO → `not_on_po` (needs_review); unit price more than ±2% off the PO price → `price_off` (needs_review); quantity > `received_quantity` → `qty_off` (waiting_on_supplier). Write `line_check_note` in plain words, e.g. "Invoiced 12 at €48.90; PO price €45.00 (+8.7%)".
   - No PO number or PO not found → waiting_on_supplier, `match_result = no_po`.
   - `tax_certificate_valid_until` empty or before today → waiting_on_supplier, `certificate_expired`.
   - `match_result`: `full_match` if every line is exact; `within_tolerance` if price differences are all within 2%; else `mismatch`.
   - `approval_level` from the total: ≤ 5,000 → `team_lead`; ≤ 25,000 → `head_of_department`; above → `cfo` (EUR).
   - `exception_reason`: one plain sentence per issue, joined with " ".
6. **Branch on document_type:**
   - `reminder`: find the existing invoice deal (supplier + invoice number), add a note "Payment reminder received <date>", create nothing else.
   - Everything else: **create the invoice deal** (`dealname` = `<invoice_number or doc type> · <supplier>`, `amount` = total, all properties above, `order_channel` = `email`/`app`, `raw_order_text` = first 5,000 characters), associate the supplier, **create line items**, and add an **audit note** listing each check and its result (✓ / ✗ + reason). A `question` goes straight to Needs review with its summary as the note.
7. **Waiting on supplier**: send the supplier one short email (Gmail, sender name "Accounts Payable (demo)") naming exactly what is missing (PO number, corrected quantity, valid tax certificate). Send it only for the email channel; for the app channel, return the draft text in the response instead.
8. Mark the email read (Gmail trigger only).

**Webhook response** (also the shape the app shows): `{ deal_id, stage, stage_label, document_type, supplier_name, invoice_number, amount, match_result, approval_level, anomaly_flags[], exception_reason, lines[{ name, quantity, price, line_check, line_check_note }], supplier_email_draft? }`.

Idempotency: before creating, search deals by `source_message_id`. If one exists, return it without creating anything (same as "Find Duplicate" in the casings flow).

## Workflow 2: "Invoice assistant chat"

Copy of "Order assistant chat". Webhook POST `/webhook/invoice-assistant` (Header Auth), body `{ session_id, message, invoice_deal_id? }`, response `{ reply }`. An AI Agent with window memory on `session_id` and three tools (sub-workflows or HTTP tool nodes): look up an invoice deal with its lines and audit note; look up a supplier (status, IBAN history, certificate); look up a PO with ordered vs received quantities. System prompt: you help the bank's AP reviewer understand why an invoice is in its stage. Cite the rule and the numbers. Never approve, reject or change anything; the reviewer does that in the app. Short answers.

## Workflow 3: "Look up purchase order" (sub-workflow / agent tool)

Inputs `po_number` or `supplier_id`. Returns the PO deal(s) with line items, ordered, received and remaining quantities, and the budget code. Used by workflow 2 (and workflow 1 if that's easier than inline HTTP nodes).

## Test before handing back

Run workflow 1 through the webhook against each of the 12 synthetic documents in `appbuilder.ai/scripts/hubspot/data/invoices/live-messages.json`. Each one lists its expected stage and exception. Report a table of expected vs actual. Validate each workflow and check `connections` after every save. Don't publish; we do that after review.
