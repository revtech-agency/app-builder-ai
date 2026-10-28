# Lovable prompts: Invoice desk (banking demo)

Send these **in order, one at a time**, and check each result before sending the next. Prompt 1 is database only (same style as `lovable-prompt-roles.md`). Fill the `<…>` IDs from `HUBSPOT.md` once the HubSpot setup has run.

What doesn't change: the casings client portal (Orders, New order, Inventory), the admin Dashboard and Admin pages, `orders.ts`, `order-rules.ts` and the landing page. The invoice desk is a **new area next to them**, so both demos keep working from one app.

---

## Prompt 1: role for the invoice desk (database only)

```
Database change only. Do not change any UI, routes, components or files under src/ other than the regenerated Supabase types.

1. Add the value `ap_reviewer` to the enum `public.app_role` (keep `admin` and `user`).
2. Seed: insert role `ap_reviewer` for the existing auth user with email `daniel@appbuilder.ai`, and for `ap-demo@appbuilder.ai` if that user exists (do nothing if a user doesn't exist or already has the role).

Then regenerate `src/integrations/supabase/types.ts`.
```

## Prompt 2: Invoice desk

```
Add an "Invoice desk" area for a bank's accounts-payable team. An AI worker (n8n) reads incoming supplier invoices, matches them against purchase orders and delivery notes (three-way match), applies procurement rules, and files each one in HubSpot in a stage. Reviewers use this area to see the queue, understand each decision, and approve or send back. Everything is synthetic demo data.

Do NOT change the existing client ordering area (routes under /app/$companyId, src/lib/orders.ts, src/lib/order-rules.ts, src/lib/cart.tsx), the landing page, or the admin Dashboard/Admin pages, except for the sidebar and /app index changes described below. Follow the existing patterns exactly: server functions with createServerFn + requireSupabaseAuth, HubSpot and n8n calls only through src/lib/hubspot.server.ts imported dynamically inside handlers, shadcn components, StatusBadge, formatMoney/formatDate, the current design system. No new secrets: reuse HUBSPOT_ACCESS_TOKEN and N8N_APP_KEY.

ACCESS
- New helper `hasRole(userId, role)` in src/lib/admin.ts next to isAdmin (same PGRST205 fallback). A middleware `requireInvoiceDesk` allows users with role `ap_reviewer` or `admin`; every invoice server function uses it.
- useAuth exposes `canUseInvoiceDesk`.
- Sidebar: a new group "Invoice desk" (shown when canUseInvoiceDesk) with Queue (/app/invoices), Submit document (/app/invoices/new), Suppliers (/app/suppliers), Purchase orders (/app/purchase-orders). Show the company switcher and client nav only when the user has companies.
- /app index: if the user has no client companies but canUseInvoiceDesk, redirect to /app/invoices instead of showing "not linked to a client company".
- Login page: next to the existing demo button, add "Try the invoice desk" that signs in `ap-demo@appbuilder.ai` the same way the current demo sign-in works (use env DEMO_AP_EMAIL / DEMO_AP_PASSWORD; hide the button if they're not set).

HUBSPOT DATA (portal 149650024, all read server-side)
- src/lib/invoice-rules.ts (pure, no imports from server code), mirroring order-rules.ts:
  - INVOICE_PIPELINE_ID = "<INVOICE_PIPELINE_ID>", PO_PIPELINE_ID = "<PO_PIPELINE_ID>"
  - INVOICE_STAGES: stage id → { key, label } for Received "<ID>", Waiting on supplier "<ID>", Needs review "<ID>", Ready to approve "<ID>", Approved for payment "<ID>", Duplicate "<ID>", Rejected "<ID>". Keys: received, waiting_on_supplier, needs_review, ready_to_approve, approved_for_payment, duplicate, rejected.
  - PRICE_TOLERANCE = 0.02; APPROVAL_LIMITS: team_lead ≤ 5000, head_of_department ≤ 25000, above = cfo; approvalLevelFor(total).
  - ANOMALY_LABELS for: duplicate, iban_mismatch, iban_recently_changed, split_purchase, unknown_supplier, supplier_blocked, certificate_expired, low_confidence (plain-English labels, e.g. "IBAN differs from the one on file").
  - Add src/test/invoice-rules.test.ts covering approvalLevelFor boundaries (5000, 5000.01, 25000, 25000.01).
- src/lib/invoices.ts server functions:
  - listInvoices(): deals in INVOICE_PIPELINE_ID, newest first, up to 200. Properties: dealname, dealstage, amount, invoice_number, invoice_date, due_date, po_number, document_type, match_result, approval_level, anomaly_flags (split on ";"), exception_reason, order_channel, createdate. Include the associated supplier company name (deal→company associations, batch read).
  - getInvoice({ dealId }): the invoice (above + iban_on_invoice, vat_amount, raw_order_text, approved_by), its line items (name, hs_sku, quantity, price, amount, po_line_ref, line_check, line_check_note), its notes (hs_note_body, hs_timestamp, newest first), the supplier (name, supplier_status, supplier_vat_id, supplier_iban, previous_iban, iban_changed_on, tax_certificate_valid_until), and the PO found by po_number in PO_PIPELINE_ID with its line items (name, hs_sku, quantity, price, received_quantity, delivery_note_ref) and budget_code. Reject deal IDs that aren't in INVOICE_PIPELINE_ID.
  - listSuppliers(): companies with supplier_status set, with the properties above plus a count of open invoices.
  - listPurchaseOrders(): deals in PO_PIPELINE_ID with po_number, budget_code, po_requester, amount, stage, supplier name, and line items with ordered vs received.
  - submitDocument({ text?, pdfBase64?, filename? }): max 5 MB PDF or 20,000 characters of text, at least one required. Calls n8n webhook "invoice-intake" with { source_id: random hex, text, pdf_base64, filename, submitted_by: caller email } and a 120 s timeout. Returns its JSON (deal_id, stage, stage_label, document_type, supplier_name, invoice_number, amount, match_result, approval_level, anomaly_flags, exception_reason, lines, supplier_email_draft).
  - decideInvoice({ dealId, decision: "approve" | "send_back" | "reject" | "duplicate", comment }): re-read the deal first. Approve is only allowed from Ready to approve; send_back moves to Waiting on supplier; reject → Rejected; duplicate → Duplicate. PATCH dealstage (and approved_by = caller email on approve), then create a note on the deal: "<Decision> by <email>: <comment>" (note→deal association typeId 214). A comment is required for reject and send_back.
  - askAssistant({ sessionId, message, dealId? }): calls n8n webhook "invoice-assistant", returns { reply }.

PAGES
1. /app/invoices — "Invoice queue"
   - Stage tabs with counts: Needs review (default), Waiting on supplier, Ready to approve, Approved for payment, Duplicate, Rejected, All.
   - Table: supplier, invoice no., invoice date, due date (red if past and not approved), amount, match result badge, approval level, anomaly chips (warning tone; iban_* and split_purchase in danger tone), channel. Row click → detail. Search box on supplier / invoice no. / PO no.
   - Header stat row: documents today, auto-cleared % (Ready to approve + Approved ÷ all), exceptions open, € waiting.
2. /app/invoices/$invoiceId — "Invoice" detail (the screen the jury will look at most; make it clear and calm)
   - Header: supplier, invoice no., amount, StatusBadge for the stage, approval level ("Needs team lead approval").
   - "Why it's here": exception_reason as plain sentences, plus anomaly chips. Then a checks list with ✓ / ✗ per rule (supplier approved, IBAN matches file, IBAN not recently changed, not a duplicate, PO found, prices within 2%, quantities delivered, tax certificate valid, confidence ≥ 0.8), derived from the data, so a reviewer can see what passed and not only what failed.
   - Three-way match table: Item | PO qty | Delivered (delivery note ref) | Invoiced | PO price | Invoice price | Result. Result uses line_check, line_check_note under the item; highlight the off cell.
   - Supplier panel: status, VAT ID, IBAN on file vs IBAN on invoice side by side (red if different), IBAN changed on (with "N days before invoice"), certificate valid until.
   - "Original document": raw text in a collapsible monospace block.
   - Activity: notes timeline (the worker's audit note and every decision).
   - Actions (sticky footer on mobile): Approve for payment (enabled only in Ready to approve; confirm dialog showing the approval level), Send back to supplier, Mark duplicate, Reject; the last three open a dialog with a required comment. After a decision, refresh and toast.
   - "Ask the worker" side panel: small chat calling askAssistant with dealId, e.g. "Why is this in review?".
3. /app/invoices/new — "Submit document"
   - Paste text (textarea) or upload one PDF, then Submit. Show a progress state ("Reading document… checking rules…"), then a result card: stage badge, supplier, invoice no., amount, match result, flags, exception reason, line results, the supplier email draft if any, and "Open invoice" to the detail page.
   - Three sample buttons that fill the textarea with synthetic examples: a clean invoice, an invoice with a changed IBAN, and an invoice with a price 8% over the PO. Write realistic text: supplier "Office Supplies Demo SRL (demo)", VAT ID RO10000001, PO-2026-0412.
4. /app/suppliers — table: name, status badge, VAT ID, IBAN (masked except the last 4), IBAN changed (warning if within 30 days), certificate valid until (danger if expired), open invoices.
5. /app/purchase-orders — collapsible cards like the Orders page: PO no., supplier, budget code, amount, stage; lines with ordered / received / remaining.

StatusBadge: add tones for received (muted), waiting_on_supplier (warning), needs_review (danger), ready_to_approve (info), approved_for_payment (success), and match results full_match (success), within_tolerance (info), mismatch (danger), no_po (warning).

Every page: loading skeletons, an empty state, and the error message, same as the Orders page. Page titles "… — AppBuilder.ai". Must work at phone width.
```

## Prompt 3 (optional, after the n8n flows are live): demo polish

```
On /app/invoices/new, after a successful submit, keep the last 5 results in a "This session" list under the form, so during a live demo we can show several documents processed in a row. On /app/invoices, auto-refresh the queue every 15 seconds while the tab is visible, so documents arriving by email appear without a reload.
```
