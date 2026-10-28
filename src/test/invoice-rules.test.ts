import { describe, expect, it } from "vitest";

import {
  applyDemoReset,
  approvalLevelFor,
  CHECK_REASONS,
  DEMO_HISTORY,
  invoiceChecks,
  isHistoryAuditNote,
  poStageFor,
  stageIdFor,
  suggestedComment,
} from "@/lib/invoice-rules";

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
  it("is open when nothing is delivered", () =>
    expect(poStageFor([line(10, 0)], false)).toBe("po_open"));
  it("is partly received when some is delivered", () =>
    expect(poStageFor([line(10, 10), line(5, 0)], false)).toBe("po_partly_received"));
  it("is fully received when every line is delivered", () =>
    expect(poStageFor([line(10, 10), line(5, 6)], false)).toBe("po_fully_received"));
  it("stays closed once closed", () => expect(poStageFor([line(10, 0)], true)).toBe("po_closed"));
});

describe("demo history", () => {
  it("restores every sample invoice to a known invoice stage", () => {
    for (const h of Object.values(DEMO_HISTORY)) expect(stageIdFor(h.stage)).not.toBeNull();
    expect(Object.keys(DEMO_HISTORY)).toHaveLength(6);
  });

  it("keeps only the setup script's audit notes", () => {
    expect(
      isHistoryAuditNote("<p><strong>AppBuilder.ai invoice worker · INV-H3</strong></p>"),
    ).toBe(true);
    expect(isHistoryAuditNote("Approved for payment by ap-demo@appbuilder.ai")).toBe(false);
    expect(isHistoryAuditNote(null)).toBe(false);
  });
});

describe("applyDemoReset", () => {
  const row = (id: string, stage: string, stageId: string, stageLabel: string) => ({
    id,
    stage,
    stageId,
    stageLabel,
  });
  const queue = [
    row("1", "needs_review", "6318170300", "Needs review"),
    row("2", "rejected", "6318170304", "Rejected"),
    row("3", "ready_to_approve", "6318170301", "Ready to approve"),
  ];

  it("drops archived invoices and restores sample stages", () => {
    const out = applyDemoReset(queue, {
      archivedIds: ["1"],
      restored: [{ id: "2", stage: "approved_for_payment" }],
    });
    expect(out.map((i) => i.id)).toEqual(["2", "3"]);
    expect(out[0]).toMatchObject({
      stage: "approved_for_payment",
      stageId: "6318170302",
      stageLabel: "Approved for payment",
    });
    expect(out[1]).toEqual(queue[2]);
  });

  it("leaves the queue alone when nothing changed", () => {
    expect(applyDemoReset(queue, { archivedIds: [], restored: [] })).toEqual(queue);
  });
});

describe("suggestedComment", () => {
  const base = {
    stageKey: "needs_review",
    invoiceDate: "2026-10-27",
    ibanOnInvoice: "RO00 OTHER",
    anomalyFlags: ["iban_mismatch"],
    supplier: {
      status: "approved",
      iban: "RO34DEMO0000000000001002",
      ibanChangedOn: null,
      certificateValidUntil: "2027-06-30",
    },
    poFound: true,
    lineChecks: [["matched"]],
  };

  it("has a reason for every check the desk shows", () => {
    for (const c of invoiceChecks(base)) expect(CHECK_REASONS[c.label]).toBeDefined();
  });

  it("starts a send-back comment from the failed checks", () =>
    expect(suggestedComment("send_back", invoiceChecks(base))).toBe(
      "Sent back because the IBAN on the invoice differs from the one on file. The supplier needs to send a corrected invoice.",
    ));

  it("joins several reasons for a rejection", () =>
    expect(
      suggestedComment("reject", [
        { label: "PO found", passed: false },
        { label: "Prices within 2%", passed: false },
        { label: "Supplier approved", passed: true },
      ]),
    ).toBe(
      "Rejected because no matching purchase order was found; some prices differ from the PO by more than 2%.",
    ));

  it("leaves the comment empty when every check passed", () =>
    expect(suggestedComment("send_back", [{ label: "PO found", passed: true }])).toBe(""));

  it("has a fixed text for duplicates", () =>
    expect(suggestedComment("duplicate", [])).toBe("Duplicate of an invoice we already received."));
});
