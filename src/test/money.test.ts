import { describe, expect, it } from "vitest";

import { invoiceRisk, lineExcess, RISK_CATEGORIES, riskTotals } from "@/lib/money";
import type { RiskInput, RiskLine } from "@/lib/money";

const line = (o: Partial<RiskLine> = {}): RiskLine => ({
  quantity: 10,
  price: 45,
  lineCheck: ["matched"],
  poPrice: 45,
  receivedQuantity: 10,
  ...o,
});
const inv = (o: Partial<RiskInput> = {}): RiskInput => ({
  amount: 544.5,
  stage: "ready_to_approve",
  anomalyFlags: [],
  matchResult: "full_match",
  documentType: "invoice",
  lines: [line()],
  ...o,
});

describe("lineExcess", () => {
  it("counts the price above the PO on every unit", () =>
    expect(lineExcess(line({ price: 48.9, lineCheck: ["price_off"] }))).toBeCloseTo(39));
  it("doesn't count a price below the PO", () =>
    expect(lineExcess(line({ price: 40, lineCheck: ["price_off"] }))).toBe(0));
  it("counts units billed beyond what was delivered", () =>
    expect(lineExcess(line({ quantity: 15, receivedQuantity: 12, lineCheck: ["qty_off"] }))).toBe(
      135,
    ));
  it("counts price and quantity without double counting", () =>
    // 3 extra units at the PO price, plus €5 over on all 15 units.
    expect(
      lineExcess(
        line({
          quantity: 15,
          price: 50,
          receivedQuantity: 12,
          lineCheck: ["price_off", "qty_off"],
        }),
      ),
    ).toBe(3 * 45 + 15 * 5));
  it("counts a whole line that isn't on the PO", () =>
    expect(
      lineExcess(line({ poPrice: null, receivedQuantity: null, lineCheck: ["not_on_po"] })),
    ).toBe(450));
  it("counts nothing on a matched line", () => expect(lineExcess(line())).toBe(0));
});

describe("invoiceRisk", () => {
  it("puts nothing at risk on a clean invoice", () =>
    expect(invoiceRisk(inv())).toEqual({ category: null, amount: 0, overbilling: 0 }));

  it("holds the whole invoice for a duplicate", () =>
    expect(invoiceRisk(inv({ stage: "duplicate", anomalyFlags: ["duplicate"] }))).toMatchObject({
      category: "duplicate",
      amount: 544.5,
    }));

  it("holds the whole invoice for an unverified payee, and still shows the overbilling", () => {
    const r = invoiceRisk(
      inv({
        amount: 591.69,
        anomalyFlags: ["iban_mismatch"],
        lines: [line({ price: 48.9, lineCheck: ["price_off"] })],
      }),
    );
    expect(r.category).toBe("payee");
    expect(r.amount).toBe(591.69);
    expect(r.overbilling).toBeCloseTo(47.19, 2); // €39 net, grossed up by the invoice's 21% VAT
  });

  it("counts only the overbilled part, incl. VAT, when that is the only problem", () => {
    const r = invoiceRisk(
      inv({ amount: 591.69, lines: [line({ price: 48.9, lineCheck: ["price_off"] })] }),
    );
    expect(r).toEqual({ category: "overbilling", amount: 47.19, overbilling: 47.19 });
  });

  it("ranks duplicate over payee over split purchase over no PO", () => {
    const cat = (o: Partial<RiskInput>) => invoiceRisk(inv(o)).category;
    expect(cat({ anomalyFlags: ["duplicate", "iban_mismatch"] })).toBe("duplicate");
    expect(cat({ anomalyFlags: ["split_purchase", "unknown_supplier"] })).toBe("payee");
    expect(cat({ anomalyFlags: ["split_purchase"], matchResult: "no_po" })).toBe("split_purchase");
    expect(cat({ matchResult: "no_po" })).toBe("no_po");
  });

  it("ignores documents that aren't invoices", () =>
    expect(
      invoiceRisk(inv({ documentType: "question", anomalyFlags: ["duplicate"] })).category,
    ).toBeNull());

  it("doesn't count a low-confidence read or an expired certificate as money at risk", () =>
    expect(
      invoiceRisk(inv({ anomalyFlags: ["low_confidence", "certificate_expired"] })).category,
    ).toBeNull());
});

describe("riskTotals", () => {
  it("adds each invoice once, under its category", () => {
    const t = riskTotals([
      invoiceRisk(inv({ stage: "duplicate" })),
      invoiceRisk(inv({ anomalyFlags: ["iban_recently_changed"], amount: 1000 })),
      invoiceRisk(inv()),
    ]);
    expect(t.total).toBe(1544.5);
    expect(t.invoices).toBe(2);
    expect(t.byCategory.duplicate).toEqual({ amount: 544.5, count: 1 });
    expect(t.byCategory.payee).toEqual({ amount: 1000, count: 1 });
    expect(Object.keys(t.byCategory)).toEqual(RISK_CATEGORIES.map((c) => c.key));
  });
});
