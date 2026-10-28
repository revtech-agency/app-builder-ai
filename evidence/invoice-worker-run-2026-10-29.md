# Invoice worker test run, 2026-10-29

**Result: 12 of 12 cases correct, on two runs in a row.**

- **Runs:** 2026-10-28 22:00:43 UTC and 22:02:07 UTC (00:00 and 00:02 Bucharest time, 29 Oct).
- **Runner:** `node n8n/invoice-worker/run-tests.mjs` (Node v24.18.0), against the production webhook `POST /webhook/invoice-intake`.
- **Workflow:** n8n "Process supplier invoices" `Kxhmr00uS4MBXTSO` on `revtech-agency.app.n8n.cloud`. The live version wasn't read for this run; the last documented version is `030f7e0f…` (see `HUBSPOT.md`).
- **HubSpot:** portal 149650024, Procure-to-pay pipeline (`default`).
- **Cleanup:** after each run, the runner archived the 12 invoices it created, with their 13 line items and 12 notes. The portal was back to its 6 sample invoices before the second run and after it. The second run got no false duplicates, which confirms the cleanup worked.

A case passes when the worker returns the expected stage and every expected flag. The runner also compares `match_result` and `document_type` when a case lists them.

| Case | What it tests | Expected | Actual | Result |
|---|---|---|---|---|
| 01-clean-match | Every line matches the PO and the delivery (Office Supplies, PO-2026-0444) | ready_to_approve | ready_to_approve | pass |
| 02-price-off | Unit price about 9% above the PO price | needs_review | needs_review | pass |
| 03-quantity-over-delivery | 15 docking stations invoiced, 12 received (PO-2026-0418) | waiting_on_supplier | waiting_on_supplier | pass |
| 04-tax-certificate-expired | SecureGuard's certificate expired on 2026-09-30 | waiting_on_supplier | waiting_on_supplier | pass |
| 05-duplicate | Resend of TN-55190, already in HubSpot | duplicate | duplicate | pass |
| 06-iban-mismatch | Asks to be paid to a different IBAN | needs_review | needs_review | pass |
| 07-iban-changed-recently | CleanPro changed its IBAN 4 days earlier | needs_review | needs_review | pass |
| 08-supplier-not-approved | PrintHouse is still in onboarding | needs_review | needs_review | pass |
| 09-unknown-supplier | Supplier not in HubSpot | needs_review | needs_review | pass |
| 10-no-po-number | Valid invoice without a PO number | waiting_on_supplier | waiting_on_supplier | pass |
| 11-split-purchase | Two TechNova invoices within 14 days, each under 5,000 EUR, 7,401 EUR together | needs_review | needs_review | pass |
| 12-supplier-question | Not an invoice: the supplier asks when it will be paid | needs_review | needs_review | pass |

To reproduce: see "Test set" in [`n8n/invoice-worker/README.md`](../n8n/invoice-worker/README.md).
