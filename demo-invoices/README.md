# Demo invoices

Send any of these to **daniel@tigros.io** (or demo+invoices@appbuilder.ai). The invoice worker in
n8n picks them up within a minute, checks them against the approval rules, adds them to the
invoice queue and emails the result to the recipient. Or use **Email intake → Send** in the app.

They are the 12 invoice worker test cases (`n8n/invoice-worker/test-cases.json`); the expected
result is what the worker reached in the 12-of-12 test run. Regenerate with
`bun scripts/demo-invoices/generate.ts`.

The invoices are also in `efactura/` as RO e-Factura XML (UBL 2.1, simplified CIUS-RO, not checked
with ANAF's validator). Upload one on **e-Factura intake** in the app, or take it from the
simulated SPV inbox there; the worker reads the fields from the XML, no PDF reading.

## Clean match

Clean invoice: every line matches the PO and the delivery (Office Supplies, PO-2026-0444).

- Expected result: **Ready to approve**
- Attachment: [01-clean-match.pdf](01-clean-match.pdf)
- e-Factura XML: [efactura/01-clean-match.xml](efactura/01-clean-match.xml)
- Subject: `Invoice OS-2026-1301 from Office Supplies Demo SRL`

```text
Hello,

Please find attached our invoice OS-2026-1301 for purchase order PO-2026-0444.

Kind regards,
Office Supplies Demo SRL
```

## Price off

Unit price about 9% above the PO price (Office Supplies, PO-2026-0444).

- Expected result: **Needs review**
- Attachment: [02-price-off.pdf](02-price-off.pdf)
- e-Factura XML: [efactura/02-price-off.xml](efactura/02-price-off.xml)
- Subject: `Invoice OS-2026-1302 from Office Supplies Demo SRL`

```text
Hello,

Please find attached our invoice OS-2026-1302 for purchase order PO-2026-0444.

Kind regards,
Office Supplies Demo SRL
```

## Quantity over delivery

Invoiced quantity is higher than what the delivery notes show as received.

- Expected result: **Waiting on supplier**
- Attachment: [03-quantity-over-delivery.pdf](03-quantity-over-delivery.pdf)
- e-Factura XML: [efactura/03-quantity-over-delivery.xml](efactura/03-quantity-over-delivery.xml)
- Subject: `Invoice TN-60003 from TechNova Hardware SRL`

```text
Hello,

Please find attached our invoice TN-60003 for purchase order PO-2026-0418.

Kind regards,
TechNova Hardware SRL
```

## Tax certificate expired

SecureGuard's tax certificate expired on 2026-09-30.

- Expected result: **Waiting on supplier** (flags: certificate_expired)
- Attachment: [04-tax-certificate-expired.pdf](04-tax-certificate-expired.pdf)
- e-Factura XML: [efactura/04-tax-certificate-expired.xml](efactura/04-tax-certificate-expired.xml)
- Subject: `Invoice SG-2026-310 from SecureGuard Services SRL`

```text
Hello,

Please find attached our invoice SG-2026-310 for purchase order PO-2026-0425.

Kind regards,
SecureGuard Services SRL
```

## Duplicate

The same invoice number as TN-55190, already in HubSpot.

- Expected result: **Duplicate** (flags: duplicate)
- Attachment: [05-duplicate.pdf](05-duplicate.pdf)
- e-Factura XML: [efactura/05-duplicate.xml](efactura/05-duplicate.xml)
- Subject: `Invoice TN-55190 from TechNova Hardware SRL`

```text
Hello,

Please find attached our invoice TN-55190 for purchase order PO-2026-0440.

Kind regards,
TechNova Hardware SRL
```

## Iban mismatch

TechNova invoice asking to be paid to a different IBAN.

- Expected result: **Needs review** (flags: iban_mismatch)
- Attachment: [06-iban-mismatch.pdf](06-iban-mismatch.pdf)
- e-Factura XML: [efactura/06-iban-mismatch.xml](efactura/06-iban-mismatch.xml)
- Subject: `Invoice TN-60006 from TechNova Hardware SRL`

```text
Hello,

Please find attached our invoice TN-60006 for purchase order PO-2026-0440.

Kind regards,
TechNova Hardware SRL
```

## Iban changed recently

CleanPro changed its IBAN on 2026-10-23, 4 days before this invoice.

- Expected result: **Needs review** (flags: iban_recently_changed)
- Attachment: [07-iban-changed-recently.pdf](07-iban-changed-recently.pdf)
- e-Factura XML: [efactura/07-iban-changed-recently.xml](efactura/07-iban-changed-recently.xml)
- Subject: `Invoice CP-2026-455 from CleanPro Facility Services SRL`

```text
Hello,

Please find attached our invoice CP-2026-455 for purchase order PO-2026-0421.

Kind regards,
CleanPro Facility Services SRL
```

## Supplier not approved

PrintHouse is still pending onboarding.

- Expected result: **Needs review** (flags: supplier_blocked)
- Attachment: [08-supplier-not-approved.pdf](08-supplier-not-approved.pdf)
- e-Factura XML: [efactura/08-supplier-not-approved.xml](efactura/08-supplier-not-approved.xml)
- Subject: `Invoice PH-802 from PrintHouse Demo SRL`

```text
Hello,

Please find attached our invoice PH-802 for purchase order PO-2026-0433.

Kind regards,
PrintHouse Demo SRL
```

## Unknown supplier

A supplier that is not in HubSpot.

- Expected result: **Needs review** (flags: unknown_supplier)
- Attachment: [09-unknown-supplier.pdf](09-unknown-supplier.pdf)
- e-Factura XML: [efactura/09-unknown-supplier.xml](efactura/09-unknown-supplier.xml)
- Subject: `Invoice NW-7001 from Northwind Traders Demo SRL`

```text
Hello,

Please find attached our invoice NW-7001 for purchase order PO-2026-0440.

Kind regards,
Northwind Traders Demo SRL
```

## No po number

A valid supplier invoice with no purchase order number.

- Expected result: **Waiting on supplier**
- Attachment: [10-no-po-number.pdf](10-no-po-number.pdf)
- e-Factura XML: [efactura/10-no-po-number.xml](efactura/10-no-po-number.xml)
- Subject: `Invoice OS-2026-1300 from Office Supplies Demo SRL`

```text
Hello,

Please find attached our invoice OS-2026-1300.

Kind regards,
Office Supplies Demo SRL
```

## Split purchase

Two TechNova invoices within 14 days, each under 5,000 EUR but 7,401 EUR together (TN-55190 is 4,961).

- Expected result: **Needs review** (flags: split_purchase)
- Attachment: [11-split-purchase.pdf](11-split-purchase.pdf)
- e-Factura XML: [efactura/11-split-purchase.xml](efactura/11-split-purchase.xml)
- Subject: `Invoice TN-60011 from TechNova Hardware SRL`

```text
Hello,

Please find attached our invoice TN-60011 for purchase order PO-2026-0440.

Kind regards,
TechNova Hardware SRL
```

## Supplier question

Not an invoice: the supplier asks when it will be paid.

- Expected result: **Needs review**
- Attachment: none, plain email
- Subject: `Payment status for invoice TN-55190`

```text
Hello Accounts Payable,
Could you tell me when invoice TN-55190 will be paid? Our finance team is asking.

Thanks,
TechNova Hardware SRL
```
