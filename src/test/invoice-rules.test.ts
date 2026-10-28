import { describe, expect, it } from "vitest";

import { approvalLevelFor, poStageFor } from "@/lib/invoice-rules";

describe("approvalLevelFor", () => {
  it("keeps 5000 with the team lead", () => expect(approvalLevelFor(5000)).toBe("team_lead"));
  it("sends 5000.01 to the head of department", () =>
    expect(approvalLevelFor(5000.01)).toBe("head_of_department"));
  it("keeps 25000 with the head of department", () =>
    expect(approvalLevelFor(25000)).toBe("head_of_department"));
  it("sends 25000.01 to the CFO", () => expect(approvalLevelFor(25000.01)).toBe("cfo"));
});

describe("poStageFor", () => {
  const line = (quantity: number, receivedQuantity: number) => ({ quantity, receivedQuantity });
  it("is open when nothing is delivered", () => expect(poStageFor([line(10, 0)], false)).toBe("po_open"));
  it("is partly received when some is delivered", () =>
    expect(poStageFor([line(10, 10), line(5, 0)], false)).toBe("po_partly_received"));
  it("is fully received when every line is delivered", () =>
    expect(poStageFor([line(10, 10), line(5, 6)], false)).toBe("po_fully_received"));
  it("stays closed once closed", () => expect(poStageFor([line(10, 0)], true)).toBe("po_closed"));
});
