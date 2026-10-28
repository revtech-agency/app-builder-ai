import { describe, expect, it } from "vitest";

import {
  computeClientBilling,
  computeTotals,
  dashboardMonths,
  monthRange,
  previousMonth,
} from "@/lib/billing";

const NOW = new Date("2026-10-28T12:00:00Z");
const plan = { monthlyFee: 99, feePerOrder: 0.6, start: "2026-08-01" };
// Invoice pipeline: Duplicate and Rejected are not billable.
const NON_BILLABLE = ["6318170303", "6318170304"];
const order = (createdAt: string, stage = "6318170298", amount = 100) => ({
  createdAt,
  stage,
  amount,
});

describe("month helpers", () => {
  it("builds inclusive ranges across a year end", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthRange("2026-11", "2026-10")).toEqual([]);
    expect(previousMonth("2027-01")).toBe("2026-12");
  });

  it("runs from the earliest start to the current month", () => {
    expect(dashboardMonths(["2026-09-01", "2026-08-01", null], NOW)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(dashboardMonths([], NOW)).toEqual(["2026-10"]);
    expect(dashboardMonths(["2027-01-01"], NOW)).toEqual(["2026-10"]);
  });
});

describe("computeClientBilling", () => {
  const months = ["2026-08", "2026-09", "2026-10"];

  it("charges subscription from the start month plus usage per billable order", () => {
    const b = computeClientBilling(
      plan,
      [
        order("2026-07-20T10:00:00Z"), // before start: no usage charged
        order("2026-09-02T10:00:00Z"),
        order("2026-10-01T00:00:00Z"),
        order("2026-10-05T10:00:00Z"),
        order("2026-10-06T10:00:00Z", "6318170303"), // duplicate
        order("2026-10-07T10:00:00Z", "6318170304"), // rejected
      ],
      months,
      NON_BILLABLE,
      NOW,
    );
    expect(b.monthly.map((m) => m.revenue)).toEqual([99, 99.6, 100.2]);
    expect(b.ordersThisMonth).toBe(2);
    expect(b.revenueThisMonth).toBe(100.2);
    expect(b.revenueLastMonth).toBe(99.6);
    expect(b.revenueToDate).toBe(298.8);
    expect(b.orderValueToDate).toBe(400);
    expect(b.active).toBe(true);
  });

  it("charges nothing before the subscription starts", () => {
    const b = computeClientBilling(
      { ...plan, start: "2026-10-01" },
      [order("2026-09-10T10:00:00Z")],
      months,
      NON_BILLABLE,
      NOW,
    );
    expect(b.monthly.map((m) => m.revenue)).toEqual([0, 0, 99]);
    expect(b.monthly[1]?.orders).toBe(1);
  });

  it("treats a future start as not active", () => {
    const b = computeClientBilling({ ...plan, start: "2026-12-01" }, [], months, NON_BILLABLE, NOW);
    expect(b.active).toBe(false);
    expect(b.revenueToDate).toBe(0);
  });

  it("lists a client without a plan with zero revenue", () => {
    const b = computeClientBilling(
      { monthlyFee: null, feePerOrder: null, start: null },
      [order("2026-10-05T10:00:00Z")],
      months,
      NON_BILLABLE,
      NOW,
    );
    expect(b.hasPlan).toBe(false);
    expect(b.revenueToDate).toBe(0);
    expect(b.active).toBe(false);
    expect(b.ordersThisMonth).toBe(1);
  });
});

describe("invoice worker billing", () => {
  it("bills €499/month plus €0.40 per document, excluding Duplicate and Rejected", () => {
    const b = computeClientBilling(
      { monthlyFee: 499, feePerOrder: 0.4, start: "2026-10-01" },
      [
        order("2026-10-02T10:00:00Z"),
        order("2026-10-03T10:00:00Z"),
        order("2026-10-04T10:00:00Z", "6318170303"),
        order("2026-10-05T10:00:00Z", "6318170304"),
      ],
      ["2026-10"],
      NON_BILLABLE,
      NOW,
    );
    expect(b.ordersThisMonth).toBe(2);
    expect(b.revenueThisMonth).toBe(499.8);
    expect(b.orderValueToDate).toBe(200);
  });
});

describe("computeTotals", () => {
  it("sums clients; MRR counts only started subscriptions", () => {
    const months = ["2026-09", "2026-10"];
    const a = computeClientBilling(
      plan,
      [order("2026-10-05T10:00:00Z")],
      months,
      NON_BILLABLE,
      NOW,
    );
    const b = computeClientBilling({ ...plan, start: "2026-12-01" }, [], months, NON_BILLABLE, NOW);
    const t = computeTotals([
      { monthlyFee: 99, billing: a },
      { monthlyFee: 99, billing: b },
    ]);
    expect(t).toMatchObject({
      mrr: 99,
      revenueThisMonth: 99.6,
      revenueLastMonth: 99,
      billableOrdersThisMonth: 1,
      activeClients: 1,
      revenueToDate: 198.6,
    });
  });
});
