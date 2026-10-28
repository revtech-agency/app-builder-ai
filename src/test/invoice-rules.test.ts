import { describe, expect, it } from "vitest";

import { approvalLevelFor } from "@/lib/invoice-rules";

describe("approvalLevelFor", () => {
  it("keeps 5000 with the team lead", () => expect(approvalLevelFor(5000)).toBe("team_lead"));
  it("sends 5000.01 to the head of department", () =>
    expect(approvalLevelFor(5000.01)).toBe("head_of_department"));
  it("keeps 25000 with the head of department", () =>
    expect(approvalLevelFor(25000)).toBe("head_of_department"));
  it("sends 25000.01 to the CFO", () => expect(approvalLevelFor(25000.01)).toBe("cfo"));
});
