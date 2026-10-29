// RO e-Factura (ANAF SPV) intake, simulated for the demo. Since 1 July 2024 Romanian B2B invoices
// go through RO e-Factura as UBL 2.1 XML (EN 16931, CIUS-RO), which the buyer downloads from SPV.
// The worker can take those fields straight from the XML, with no PDF reading.
//
// buildUbl writes a demo invoice as a simplified CIUS-RO XML (the fields the worker uses; not
// checked against ANAF's validator). ublToText reads such an XML back into the plain-text layout
// the invoice worker's 12 test cases use, so an e-Factura invoice reaches the same checks.
// No dependencies: it runs in the browser, on the server (no DOMParser there) and in scripts.

export type UblLine = {
  code: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type UblInvoice = {
  number: string;
  supplier: string;
  vatId: string;
  issueDate: string;
  dueDate: string;
  poNumber: string | null;
  iban: string;
  currency: string;
  lines: UblLine[];
  net: string;
  vatPercent: string;
  vat: string;
  total: string;
};

// The demo buyer: the bank's accounts-payable entity (fictional).
const BUYER = { name: "Demo Bank SA (demo)", vatId: "RO00000000" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- demo text -> invoice ----------

const field = (text: string, label: string) =>
  new RegExp(`^${label}:\\s*(.+)$`, "m").exec(text)?.[1]?.trim() ?? "";

export function parseInvoiceText(text: string): UblInvoice | null {
  const number = /^INVOICE\s+(\S+)/m.exec(text)?.[1];
  if (!number) return null;
  const po = field(text, "Purchase order");
  const vatLine = /^VAT (\d+(?:\.\d+)?)%:\s*(\S+)/m.exec(text);
  const lines = text
    .split("\n")
    .filter((l) => l.split("|").length === 5 && !/^Item code\s*\|/.test(l))
    .map((l) => {
      const [code, description, quantity, unitPrice, lineTotal] = l.split("|").map((p) => p.trim());
      return {
        code: code ?? "",
        description: description ?? "",
        quantity: quantity ?? "",
        unitPrice: unitPrice ?? "",
        lineTotal: lineTotal ?? "",
      };
    });
  return {
    number,
    supplier: field(text, "Supplier"),
    vatId: field(text, "VAT ID"),
    issueDate: field(text, "Invoice date"),
    dueDate: field(text, "Due date"),
    poNumber: po && po !== "(none)" ? po : null,
    iban: field(text, "Bank account \\(IBAN\\)"),
    currency: field(text, "Currency") || "EUR",
    lines,
    net: field(text, "Net"),
    vatPercent: vatLine?.[1] ?? "21",
    vat: vatLine?.[2] ?? "",
    total: field(text, "Total due"),
  };
}

// ---------- invoice -> UBL XML ----------

export function buildUbl(inv: UblInvoice): string {
  const cur = esc(inv.currency);
  const amt = (tag: string, v: string) => `<cbc:${tag} currencyID="${cur}">${esc(v)}</cbc:${tag}>`;
  const taxCategory = (tag: string) =>
    `<cac:${tag}><cbc:ID>S</cbc:ID><cbc:Percent>${esc(inv.vatPercent)}</cbc:Percent>` +
    `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:${tag}>`;
  const party = (p: { name: string; vatId: string }) =>
    `<cac:Party>` +
    `<cac:PostalAddress><cbc:CityName>Bucuresti</cbc:CityName><cbc:CountrySubentity>RO-B</cbc:CountrySubentity>` +
    `<cac:Country><cbc:IdentificationCode>RO</cbc:IdentificationCode></cac:Country></cac:PostalAddress>` +
    `<cac:PartyTaxScheme><cbc:CompanyID>${esc(p.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` +
    `<cac:PartyLegalEntity><cbc:RegistrationName>${esc(p.name)}</cbc:RegistrationName></cac:PartyLegalEntity>` +
    `</cac:Party>`;
  const lines = inv.lines
    .map(
      (l, i) =>
        `  <cac:InvoiceLine>\n` +
        `    <cbc:ID>${i + 1}</cbc:ID>\n` +
        `    <cbc:InvoicedQuantity unitCode="H87">${esc(l.quantity)}</cbc:InvoicedQuantity>\n` +
        `    ${amt("LineExtensionAmount", l.lineTotal)}\n` +
        `    <cac:Item><cbc:Name>${esc(l.description)}</cbc:Name>` +
        `<cac:SellersItemIdentification><cbc:ID>${esc(l.code)}</cbc:ID></cac:SellersItemIdentification>` +
        `${taxCategory("ClassifiedTaxCategory")}</cac:Item>\n` +
        `    <cac:Price>${amt("PriceAmount", l.unitPrice)}</cac:Price>\n` +
        `  </cac:InvoiceLine>`,
    )
    .join("\n");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    `  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>`,
    `  <cbc:ID>${esc(inv.number)}</cbc:ID>`,
    `  <cbc:IssueDate>${esc(inv.issueDate)}</cbc:IssueDate>`,
    `  <cbc:DueDate>${esc(inv.dueDate)}</cbc:DueDate>`,
    `  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>`,
    `  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>`,
    ...(inv.poNumber
      ? [`  <cac:OrderReference><cbc:ID>${esc(inv.poNumber)}</cbc:ID></cac:OrderReference>`]
      : []),
    `  <cac:AccountingSupplierParty>${party({ name: inv.supplier, vatId: inv.vatId })}</cac:AccountingSupplierParty>`,
    `  <cac:AccountingCustomerParty>${party(BUYER)}</cac:AccountingCustomerParty>`,
    `  <cac:PaymentMeans><cbc:PaymentMeansCode>30</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${esc(inv.iban)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>`,
    `  <cac:TaxTotal>${amt("TaxAmount", inv.vat)}<cac:TaxSubtotal>${amt("TaxableAmount", inv.net)}${amt("TaxAmount", inv.vat)}${taxCategory("TaxCategory")}</cac:TaxSubtotal></cac:TaxTotal>`,
    `  <cac:LegalMonetaryTotal>${amt("LineExtensionAmount", inv.net)}${amt("TaxExclusiveAmount", inv.net)}${amt("TaxInclusiveAmount", inv.total)}${amt("PayableAmount", inv.total)}</cac:LegalMonetaryTotal>`,
    lines,
    `</Invoice>`,
    ``,
  ].join("\n");
}

// ---------- UBL XML -> invoice ----------

type XmlNode = { name: string; children: XmlNode[]; text: string };

const unesc = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

// A minimal XML reader: elements and their text, namespace prefixes dropped. Enough for UBL;
// comments, processing instructions and CDATA are handled, DTDs are not.
function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#root", children: [], text: "" };
  const stack = [root];
  const re =
    /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1]!;
    if (m[1] !== undefined) top.text += m[1];
    else if (m[3]) {
      const name = m[3].replace(/^.*:/, "");
      if (m[2]) {
        if (stack.length > 1) stack.pop();
      } else {
        const node: XmlNode = { name, children: [], text: "" };
        top.children.push(node);
        if (!m[5]) stack.push(node);
      }
    } else if (m[6]) top.text += unesc(m[6]);
  }
  return root;
}

const child = (n: XmlNode | undefined, ...path: string[]): XmlNode | undefined =>
  path.reduce<XmlNode | undefined>((cur, name) => cur?.children.find((c) => c.name === name), n);
const text = (n: XmlNode | undefined, ...path: string[]) => child(n, ...path)?.text.trim() ?? "";

export function readUbl(xml: string): UblInvoice | null {
  const inv = parseXml(xml).children.find((c) => c.name === "Invoice");
  if (!inv) return null;
  const supplier = child(inv, "AccountingSupplierParty", "Party");
  const subtotal = child(inv, "TaxTotal", "TaxSubtotal");
  return {
    number: text(inv, "ID"),
    supplier:
      text(supplier, "PartyLegalEntity", "RegistrationName") || text(supplier, "PartyName", "Name"),
    vatId: text(supplier, "PartyTaxScheme", "CompanyID"),
    issueDate: text(inv, "IssueDate"),
    dueDate: text(inv, "DueDate"),
    poNumber: text(inv, "OrderReference", "ID") || null,
    iban: text(inv, "PaymentMeans", "PayeeFinancialAccount", "ID"),
    currency: text(inv, "DocumentCurrencyCode") || "EUR",
    lines: inv.children
      .filter((c) => c.name === "InvoiceLine")
      .map((l) => ({
        code: text(l, "Item", "SellersItemIdentification", "ID"),
        description: text(l, "Item", "Name"),
        quantity: text(l, "InvoicedQuantity"),
        unitPrice: text(l, "Price", "PriceAmount"),
        lineTotal: text(l, "LineExtensionAmount"),
      })),
    net: text(inv, "LegalMonetaryTotal", "TaxExclusiveAmount"),
    vatPercent: text(subtotal, "TaxCategory", "Percent") || "21",
    vat: text(inv, "TaxTotal", "TaxAmount"),
    total: text(inv, "LegalMonetaryTotal", "PayableAmount"),
  };
}

// ---------- invoice -> the worker's text layout ----------

export function invoiceText(inv: UblInvoice): string {
  return [
    `INVOICE ${inv.number}`,
    `Supplier: ${inv.supplier}`,
    `VAT ID: ${inv.vatId}`,
    `Invoice date: ${inv.issueDate}`,
    `Due date: ${inv.dueDate}`,
    `Purchase order: ${inv.poNumber ?? "(none)"}`,
    `Bank account (IBAN): ${inv.iban}`,
    `Currency: ${inv.currency}`,
    ``,
    `Item code | Description | Qty | Unit price | Line total`,
    ...inv.lines.map((l) =>
      [l.code, l.description, l.quantity, l.unitPrice, l.lineTotal].join(" | "),
    ),
    ``,
    `Net: ${inv.net}`,
    `VAT ${inv.vatPercent}%: ${inv.vat}`,
    `Total due: ${inv.total}`,
  ].join("\n");
}

export const ublToText = (xml: string) => {
  const inv = readUbl(xml);
  return inv ? invoiceText(inv) : null;
};
