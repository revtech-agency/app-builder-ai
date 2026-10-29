import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { InvoiceSummary } from "@/lib/invoices";
import { invoiceRisk } from "@/lib/money";

// recharts needs ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ isAdmin: false, isDemo: false }) }));

const summary = (o: Partial<InvoiceSummary> & { id: string; amount: number }): InvoiceSummary => {
  const base: InvoiceSummary = {
    name: o.id,
    stageId: "",
    stage: "ready_to_approve",
    stageLabel: "Ready to approve",
    invoiceNumber: o.id,
    invoiceDate: "2026-10-27",
    dueDate: "2026-11-26",
    poNumber: "PO-1",
    documentType: "invoice",
    matchResult: "full_match",
    approvalLevel: "team_lead",
    anomalyFlags: [],
    exceptionReason: null,
    channel: "email",
    createdAt: "2026-10-29T08:00:00Z",
    supplierName: "Demo SRL",
    risk: { category: null, amount: 0, overbilling: 0 },
    ...o,
  };
  return {
    ...base,
    risk: invoiceRisk({ ...base, lines: [] }),
  };
};

const INVOICES = [
  summary({ id: "DUP-1", amount: 9510.6, stage: "duplicate", anomalyFlags: ["duplicate"] }),
  summary({
    id: "IBAN-1",
    amount: 2440.33,
    stage: "needs_review",
    anomalyFlags: ["iban_mismatch"],
    channel: "efactura",
  }),
  summary({ id: "OK-1", amount: 2250.6, channel: "app" }),
];

vi.mock("@/lib/invoices", () => ({
  listInvoices: vi.fn(async () => INVOICES),
  listPurchaseOrders: vi.fn(async () => []),
  listSuppliers: vi.fn(async () => []),
  listEfacturaIntake: vi.fn(async () => INVOICES.filter((i) => i.channel === "efactura")),
  resetDemo: vi.fn(),
}));

import { P2pOverview } from "@/components/p2p-overview";
import { Route as EfacturaRoute } from "@/routes/app/efactura";
import { Route as QueueRoute } from "@/routes/app/invoices/index";

const wrap = (node: ReactNode) =>
  render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

describe("money on the overview", () => {
  it("shows the risky payments held, split by reason, against the benchmark and the cost", async () => {
    wrap(<P2pOverview />);
    const card = (await screen.findByText("Risky payments held before payment")).closest(
      "[class*=border-primary]",
    ) as HTMLElement;
    expect(within(card).getByText("€11,950.93")).toBeTruthy();
    expect(within(card).getByText(/on 2 of 3 invoices/)).toBeTruthy();
    expect(within(card).getByText("€9,510.60 · 1")).toBeTruthy(); // duplicates stopped
    expect(within(card).getByText("€2,440.33 · 1")).toBeTruthy(); // unverified payee held
    expect(screen.getByText("€14,201.53")).toBeTruthy(); // spend checked
    expect(screen.getByText("€4.50")).toBeTruthy(); // 3 invoices × €1.50
    expect(screen.getByText(/20,000 invoices a year × €1.50 = €30k/)).toBeTruthy();
  });
});

describe("money and source in the queue", () => {
  it("adds the held total, an At risk column and a Source column", async () => {
    wrap(<>{QueueRoute.options.component && <QueueRoute.options.component />}</>);
    expect(await screen.findByText("Risky payments held")).toBeTruthy();
    expect(screen.getByText("€11,950.93")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "At risk" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeTruthy();
  });
});

describe("e-Factura intake page", () => {
  it("says the SPV is simulated, lists what came in with the money held, and offers the demo XML", async () => {
    const Page = EfacturaRoute.options.component!;
    wrap(<Page />);
    expect(screen.getByText("Simulated SPV")).toBeTruthy();
    expect(await screen.findByText("IBAN-1")).toBeTruthy();
    expect(screen.getAllByText("€2,440.33").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Receive from SPV/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Show all 11" })).toBeTruthy();
  });
});
