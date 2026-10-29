import { describe, expect, it } from "vitest";

import cases from "../../n8n/invoice-worker/test-cases.json";
import { buildUbl, invoiceText, parseInvoiceText, readUbl, ublToText } from "@/lib/efactura";
import { EFACTURA_DEMOS, efacturaDemo } from "@/lib/intake";

const texts = (cases as { id: string; request: { text: string } }[]).filter((c) =>
  c.request.text.startsWith("INVOICE "),
);

describe("e-Factura XML", () => {
  it("offers the 11 invoice test cases in the simulated SPV inbox", () => {
    expect(EFACTURA_DEMOS).toHaveLength(11);
    expect(texts).toHaveLength(11);
  });

  // The worker went 12 of 12 on these exact texts, so an e-Factura invoice must read back the same.
  it.each(texts.map((c) => [c.id, c.request.text]))(
    "reads %s back to the tested text",
    (_id, text) => {
      expect(ublToText(buildUbl(parseInvoiceText(text)!))).toBe(text);
    },
  );

  it("writes a CIUS-RO invoice with the payee IBAN and the PO", () => {
    const xml = buildUbl(efacturaDemo("01-clean-match")!);
    expect(xml).toContain("urn:efactura.mfinante.ro:CIUS-RO:1.0.1");
    expect(xml).toContain("<cac:PayeeFinancialAccount><cbc:ID>RO12DEMO0000000000001001</cbc:ID>");
    expect(xml).toContain("<cac:OrderReference><cbc:ID>PO-2026-0444</cbc:ID></cac:OrderReference>");
  });

  it("leaves the PO out when the invoice has none", () => {
    const xml = buildUbl(efacturaDemo("10-no-po-number")!);
    expect(xml).not.toContain("OrderReference");
    expect(ublToText(xml)).toContain("Purchase order: (none)");
  });

  it("escapes and unescapes special characters", () => {
    const inv = { ...efacturaDemo("01-clean-match")!, supplier: 'A & B <"Demo"> SRL' };
    const xml = buildUbl(inv);
    expect(xml).toContain("A &amp; B &lt;&quot;Demo&quot;&gt; SRL");
    expect(readUbl(xml)?.supplier).toBe('A & B <"Demo"> SRL');
  });

  it("reads XML with other namespace prefixes and a party name instead of a legal name", () => {
    const xml = `<?xml version="1.0"?>
<!-- downloaded from SPV -->
<ns:Invoice xmlns:ns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:a="x" xmlns:b="y">
  <b:ID>X-1</b:ID><b:IssueDate>2026-10-01</b:IssueDate>
  <a:AccountingSupplierParty><a:Party><a:PartyName><b:Name>Other SRL</b:Name></a:PartyName>
    <a:PartyTaxScheme><b:CompanyID>RO123</b:CompanyID></a:PartyTaxScheme></a:Party></a:AccountingSupplierParty>
  <a:InvoiceLine><b:InvoicedQuantity unitCode="H87">2</b:InvoicedQuantity><b:LineExtensionAmount>20</b:LineExtensionAmount>
    <a:Item><b:Name>Widget</b:Name></a:Item><a:Price><b:PriceAmount>10</b:PriceAmount></a:Price></a:InvoiceLine>
  <a:LegalMonetaryTotal><b:TaxExclusiveAmount>20</b:TaxExclusiveAmount><b:PayableAmount>24.20</b:PayableAmount></a:LegalMonetaryTotal>
</ns:Invoice>`;
    const inv = readUbl(xml)!;
    expect(inv).toMatchObject({
      number: "X-1",
      supplier: "Other SRL",
      vatId: "RO123",
      poNumber: null,
      total: "24.20",
    });
    expect(invoiceText(inv)).toContain(" | Widget | 2 | 10 | 20");
  });

  it("returns null for XML that isn't an invoice", () => {
    expect(ublToText("<Order><ID>1</ID></Order>")).toBeNull();
    expect(ublToText("not xml")).toBeNull();
  });
});
