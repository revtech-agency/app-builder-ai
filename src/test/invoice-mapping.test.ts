import { describe, expect, it } from "vitest";

import {
  computeOverview,
  decisionPermission,
  isDemoEmail,
  latestAudit,
  num,
  parseAuditNote,
  parseFlags,
  stageOf,
  toSummary,
} from "@/lib/invoice-mapping";
import type { InvoiceStageKey, InvoiceSummary, AnomalyFlag } from "@/lib/invoice-types";

const inv = (
  stage: InvoiceStageKey,
  amount: number,
  anomalyFlags: AnomalyFlag[] = [],
): InvoiceSummary => ({
  id: Math.random().toString(),
  ref: "X",
  supplierId: null,
  supplierName: "S",
  stage,
  stageLabel: stage,
  documentType: "invoice",
  amount,
  invoiceDate: null,
  dueDate: null,
  poNumber: null,
  matchResult: null,
  approvalLevel: null,
  anomalyFlags,
  exceptionReason: null,
  channel: null,
  createdAt: "",
});

describe("parsing", () => {
  it("parses the audit note rows", () => {
    const html =
      "<p><b>Invoice worker audit</b> - result: needs_review</p><ul>" +
      "<li>&#10003; Supplier: Acme is approved.</li>" +
      "<li>&#10007; IBAN: differs: verify by phone</li>" +
      "<li>✓ Duplicate check</li></ul>";
    expect(parseAuditNote(html)).toEqual([
      { ok: true, name: "Supplier", detail: "Acme is approved." },
      { ok: false, name: "IBAN", detail: "differs: verify by phone" },
      { ok: true, name: "Duplicate check", detail: "" },
    ]);
  });

  it("picks the newest audit note and ignores other notes", () => {
    const mk = (id: string, ts: string, body: string) => ({
      id,
      properties: { hs_note_body: body, hs_timestamp: ts },
    });
    const audit = (n: string) => `<b>Invoice worker audit</b><ul><li>&#10003; ${n}: ok</li></ul>`;
    const out = latestAudit([
      mk("1", "2026-01-01T00:00:00Z", audit("Old")),
      mk("2", "2026-02-01T00:00:00Z", audit("New")),
      mk("3", "2026-03-01T00:00:00Z", "<p>Approved by x</p>"),
    ]);
    expect(out[0]?.name).toBe("New");
  });

  it("keeps only known flags", () => {
    expect(parseFlags("iban_mismatch;bogus; duplicate")).toEqual(["iban_mismatch", "duplicate"]);
    expect(parseFlags(null)).toEqual([]);
  });

  it("maps stages, unknown falls back to received", () => {
    expect(stageOf("6318170301").key).toBe("ready_to_approve");
    expect(stageOf("nope").key).toBe("received");
  });

  it("num is safe", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("abc")).toBeNull();
    expect(num("")).toBeNull();
    expect(num(undefined)).toBeNull();
  });

  it("maps a deal to a summary", () => {
    const s = toSummary(
      {
        id: "9",
        properties: {
          dealname: "INV-1 · Acme",
          dealstage: "6318170300",
          document_type: "invoice",
          amount: "10.5",
          approval_level: "cfo",
          match_result: "weird",
          anomaly_flags: "low_confidence",
        },
      },
      null,
    );
    expect(s).toMatchObject({
      ref: "INV-1",
      supplierName: "Acme",
      stage: "needs_review",
      amount: 10.5,
      approvalLevel: "cfo",
      matchResult: null,
      anomalyFlags: ["low_confidence"],
    });
  });
});

describe("decisionPermission", () => {
  const base = { approvalLevel: "team_lead" as const, isAdmin: false, isDemo: false };
  it("admin may decide any level in decidable stages", () => {
    expect(decisionPermission({ ...base, stage: "needs_review", approvalLevel: "cfo", isAdmin: true }).canDecide).toBe(true);
    expect(decisionPermission({ ...base, stage: "approved", isAdmin: true }).canDecide).toBe(false);
    expect(decisionPermission({ ...base, stage: "waiting_on_supplier", isAdmin: true }).canDecide).toBe(false);
  });
  it("demo reviewer only team_lead", () => {
    expect(decisionPermission({ ...base, stage: "ready_to_approve", isDemo: true }).canDecide).toBe(true);
    const r = decisionPermission({ ...base, stage: "ready_to_approve", approvalLevel: "head_of_department", isDemo: true });
    expect(r.canDecide).toBe(false);
    expect(r.cannotDecideReason).toBe("Head-of-department approval is needed for this amount.");
  });
  it("others cannot decide", () => {
    expect(decisionPermission({ ...base, stage: "ready_to_approve" }).canDecide).toBe(false);
  });
  it("matches the demo email", () => {
    expect(isDemoEmail("Demo@AppBuilder.ai")).toBe(true);
    expect(isDemoEmail("x@y.z", "x@y.z")).toBe(true);
    expect(isDemoEmail("x@y.z")).toBe(false);
  });
});

describe("computeOverview", () => {
  const o = computeOverview([
    inv("ready_to_approve", 100),
    inv("approved", 200),
    inv("approved", 50, ["iban_mismatch"]),
    inv("needs_review", 300),
    inv("needs_review", 400, ["iban_mismatch", "low_confidence"]),
    inv("waiting_on_supplier", 500, ["certificate_expired"]),
    inv("duplicate", 600, ["duplicate"]),
    inv("rejected", 700),
  ]);
  it("counts stages in pipeline order", () => {
    expect(o.byStage.map((s) => s.stage)).toEqual([
      "received", "waiting_on_supplier", "needs_review", "ready_to_approve", "approved", "duplicate", "rejected",
    ]);
    expect(o.byStage.find((s) => s.stage === "approved")).toMatchObject({ count: 2, amount: 250 });
    expect(o.totalInvoices).toBe(8);
  });
  it("cleared excludes flagged, duplicate and rejected", () => {
    expect(o.clearedAutomatically).toBe(2);
    expect(o.clearedAutomaticallyPct).toBe(25);
    expect(o.amountCleared).toBe(300);
    expect(o.minutesSaved).toBe(12);
  });
  it("held back = needs_review + waiting + duplicate", () => {
    expect(o.amountHeldBack).toBe(300 + 400 + 500 + 600);
  });
  it("counts exceptions by flag plus other", () => {
    const get = (f: string) => o.exceptionsByFlag.find((e) => e.flag === f)?.count;
    expect(get("iban_mismatch")).toBe(2);
    expect(get("low_confidence")).toBe(1);
    expect(get("other")).toBe(1);
  });
  it("handles empty input", () => {
    expect(computeOverview([]).clearedAutomaticallyPct).toBe(0);
  });
});
