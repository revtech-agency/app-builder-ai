import { describe, expect, it } from "vitest";

import { DEMO_STEPS, nextDemoStep } from "@/lib/demo-guide";

describe("nextDemoStep", () => {
  it("starts with submitting a sample", () => expect(nextDemoStep([])?.key).toBe("submitted"));
  it("follows the steps in order, whatever order they were done in", () =>
    expect(nextDemoStep(["opened", "submitted"])?.key).toBe("asked"));
  it("is done after the reset", () =>
    expect(nextDemoStep(DEMO_STEPS.map((s) => s.key))).toBeNull());
});
