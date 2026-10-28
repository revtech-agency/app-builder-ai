import { describe, expect, it } from "vitest";

import { evaluateLine, orderStage, packsFor, worstStage } from "@/lib/order-rules";

const reel = { unitsPerPack: 50, minSalePacks: 2, packType: "reel", stockPacks: 10 };

describe("packsFor", () => {
  it("rounds up to whole packs", () => {
    expect(packsFor(120, 50)).toBe(3);
  });
  it("tolerates float noise", () => {
    expect(packsFor(0.3 * 1000, 50)).toBe(6);
  });
  it("applies the minimum sale packs", () => {
    expect(packsFor(50, 50, 2)).toBe(2);
  });
});

describe("evaluateLine", () => {
  it("is ready when metres are whole packs and in stock", () => {
    const e = evaluateLine({ ...reel, metres: 100 });
    expect(e).toMatchObject({ packs: 2, roundingNote: null, stockNote: null, stage: "ready" });
  });
  it("notes rounding and waits on the client", () => {
    const e = evaluateLine({ ...reel, metres: 120 });
    expect(e.packs).toBe(3);
    expect(e.roundingNote).toBe("120 m rounded up to 3 reels (150 m)");
    expect(e.stage).toBe("waiting");
  });
  it("notes low stock", () => {
    const e = evaluateLine({ ...reel, metres: 1000, stockPacks: 5 });
    expect(e.stockNote).toBe("only 5 in stock");
    expect(e.stage).toBe("waiting");
  });
});

describe("orderStage", () => {
  const ok = evaluateLine({ ...reel, metres: 100 });
  it("is ready with a delivery date and clean lines", () => {
    expect(orderStage([ok], true, "paid")).toBe("ready");
  });
  it("waits without a delivery date", () => {
    expect(orderStage([ok], false)).toBe("waiting");
  });
  it("needs staff when payment is overdue", () => {
    expect(orderStage([ok], true, "overdue")).toBe("staff");
  });
  it("ranks ready < waiting < staff", () => {
    expect(worstStage("ready", "waiting")).toBe("waiting");
    expect(worstStage("staff", "waiting")).toBe("staff");
  });
});
