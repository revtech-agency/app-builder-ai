// Suppliers, overview and sidebar screens.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatEur } from "@/lib/format";
import { FIXTURE_SUPPLIERS } from "@/lib/invoice-fixtures";
import type { OverviewStats, SupplierInfo } from "@/lib/invoice-types";

import { api, authState, freshInvoices, renderAt, resetApi, strip } from "./invoice-harness";

vi.mock("@/lib/invoices", async () => (await import("./invoice-mocks")).api);
vi.mock("@/lib/auth", async () => (await import("./invoice-mocks")).mockAuthModule);

// Recharts measures its container with ResizeObserver, which jsdom does not have.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", NoopResizeObserver);

const STATS: OverviewStats = {
  totalInvoices: 5,
  byStage: [
    { stage: "received", label: "Received", count: 0, amount: 0 },
    { stage: "waiting_on_supplier", label: "Waiting on supplier", count: 1, amount: 12632.4 },
    { stage: "needs_review", label: "Needs review", count: 2, amount: 9413.8 },
    { stage: "ready_to_approve", label: "Ready to approve", count: 1, amount: 2250.6 },
    { stage: "approved", label: "Approved for payment", count: 1, amount: 9510.6 },
    { stage: "duplicate", label: "Duplicate", count: 0, amount: 0 },
    { stage: "rejected", label: "Rejected", count: 0, amount: 0 },
  ],
  clearedAutomatically: 2,
  clearedAutomaticallyPct: 40,
  exceptionsByFlag: [
    { flag: "iban_mismatch", label: "IBAN differs from the one on file", count: 3 },
    { flag: "certificate_expired", label: "Tax certificate expired or missing", count: 1 },
    { flag: "other", label: "Other (price, quantity, PO)", count: 1 },
  ],
  amountCleared: 11761.2,
  amountHeldBack: 22046.2,
  minutesSaved: 135,
};

describe("Suppliers page", () => {
  beforeEach(() => resetApi());

  it("lists suppliers with masked IBANs, never the full number", async () => {
    renderAt("/app/suppliers");

    expect(await screen.findByText("Office Supplies Demo SRL (demo)")).toBeInTheDocument();
    for (const s of FIXTURE_SUPPLIERS) {
      expect(screen.getByText(s.name)).toBeInTheDocument();
      expect(screen.queryByText(s.iban!)).not.toBeInTheDocument();
    }
    // Only the country code and the last four characters remain.
    expect(screen.getByText("RO•• ••••1001")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("RO12DEMO0000000000001001");
    expect(screen.getByText("RO10000001")).toBeInTheDocument();
    expect(screen.getByText("pending onboarding")).toBeInTheDocument();
  });

  it("marks the expired tax certificate and only that one", async () => {
    renderAt("/app/suppliers");
    const row = (await screen.findByText("SecureGuard Services SRL (demo)")).closest("tr")!;

    expect(row).toHaveTextContent(`Expired (${formatDate("2026-09-30")})`);
    expect(screen.getAllByText(/Expired/)).toHaveLength(1);
    const ok = screen.getByText("Office Supplies Demo SRL (demo)").closest("tr")!;
    expect(within(ok).getByText(formatDate("2027-03-31"))).toBeInTheDocument();
  });

  it("links the open-invoice count to the invoices page and shows 0 without a link", async () => {
    renderAt("/app/suppliers");
    const withOpen = (await screen.findByText("Office Supplies Demo SRL (demo)")).closest("tr")!;
    expect(within(withOpen).getByRole("link", { name: "1" })).toHaveAttribute(
      "href",
      "/app/invoices",
    );
    const none = screen.getByText("PrintHouse Demo SRL (demo)").closest("tr")!;
    expect(within(none).queryByRole("link")).not.toBeInTheDocument();
    expect(within(none).getByText("0")).toBeInTheDocument();
  });

  it("shows a recently changed IBAN as a masked warning with the previous number", async () => {
    const changed = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    const suppliers: SupplierInfo[] = [
      {
        ...FIXTURE_SUPPLIERS[0]!,
        previousIban: "RO99OLDB0000000000002222",
        ibanChangedOn: changed,
      },
    ];
    api.listSuppliers.mockResolvedValue(suppliers);
    renderAt("/app/suppliers");

    expect(await screen.findByText("RO•• ••••2222")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("RO99OLDB0000000000002222");
    expect(screen.getByText(/changed \d/)).toBeInTheDocument();
  });

  it("handles a missing IBAN, an empty list and a load error", async () => {
    api.listSuppliers.mockResolvedValueOnce([{ ...FIXTURE_SUPPLIERS[0]!, iban: null, vatId: null }]);
    const first = renderAt("/app/suppliers");
    const row = (await screen.findByText("Office Supplies Demo SRL (demo)")).closest("tr")!;
    expect(within(row).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    first.unmount();

    api.listSuppliers.mockResolvedValueOnce([]);
    const second = renderAt("/app/suppliers");
    expect(await screen.findByText("No suppliers yet.")).toBeInTheDocument();
    second.unmount();

    api.listSuppliers.mockRejectedValueOnce(new Error("HubSpot isn't configured yet."));
    renderAt("/app/suppliers");
    expect(await screen.findByText("HubSpot isn't configured yet.")).toBeInTheDocument();
  });
});

describe("Overview page", () => {
  beforeEach(() => resetApi());

  it("shows the KPI values from getOverview", async () => {
    api.getOverview.mockResolvedValue(STATS);
    renderAt("/app/overview");

    expect(await screen.findByText("Cleared automatically")).toBeInTheDocument();
    const card = (label: string) =>
      within(screen.getByText(label).closest("div.rounded-xl") as HTMLElement);
    expect(card("Cleared automatically").getByText("40%")).toBeInTheDocument();
    expect(card("Cleared automatically").getByText("2 of 5 invoices")).toBeInTheDocument();
    expect(card("Time saved").getByText("2 h 15 min")).toBeInTheDocument();
    expect(card("Time saved").getByText("about 6 minutes per clean invoice")).toBeInTheDocument();
    expect(card("Amount cleared").getByText(formatEur(11761.2))).toBeInTheDocument();
    expect(card("Held back for review").getByText(formatEur(22046.2))).toBeInTheDocument();
  });

  it("lists why invoices were stopped, with counts", async () => {
    api.getOverview.mockResolvedValue(STATS);
    renderAt("/app/overview");

    const list = (await screen.findByText("Why invoices were stopped"))
      .closest("div.rounded-xl")!
      .querySelector("ul") as HTMLElement;
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("IBAN differs from the one on file");
    expect(items[0]).toHaveTextContent("3");
    expect(items[2]).toHaveTextContent("Other (price, quantity, PO)");
    expect(screen.getByRole("link", { name: /Go to invoices/ })).toHaveAttribute(
      "href",
      "/app/invoices",
    );
  });

  it("computes sensible numbers from the fixture invoices", async () => {
    renderAt("/app/overview");

    expect(await screen.findByText("2 of 5 invoices")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.getByText(formatEur(2250.6 + 9510.6))).toBeInTheDocument();
  });

  it("says nothing was stopped when there are no exceptions", async () => {
    api.getOverview.mockResolvedValue({ ...STATS, exceptionsByFlag: [] });
    renderAt("/app/overview");

    expect(await screen.findByText("No invoices have been stopped.")).toBeInTheDocument();
  });

  it("shows the error message when the overview cannot load", async () => {
    api.getOverview.mockRejectedValue(new Error("The supplier list is unavailable right now."));
    renderAt("/app/overview");

    expect(await screen.findByText("The supplier list is unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByText("Cleared automatically")).not.toBeInTheDocument();
  });
});

describe("Sidebar", () => {
  beforeEach(() => resetApi());

  it("shows Overview, Invoices, Intake and Suppliers, each linking to its page", async () => {
    renderAt("/app/overview");
    await screen.findByRole("heading", { level: 1, name: "Overview" });

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/app/overview");
    expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/app/invoices");
    expect(screen.getByRole("link", { name: "Intake" })).toHaveAttribute("href", "/app/intake");
    expect(screen.getByRole("link", { name: "Suppliers" })).toHaveAttribute("href", "/app/suppliers");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: "Invoices" })).not.toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("shows the needs-review count as a badge on Invoices", async () => {
    renderAt("/app/overview");

    await waitFor(() => {
      const badge = document.querySelector('[data-sidebar="menu-badge"]');
      expect(badge).toHaveTextContent("2");
    });
    expect(document.querySelectorAll('[data-sidebar="menu-badge"]')).toHaveLength(1);
    const invoicesItem = screen.getByRole("link", { name: "Invoices" }).closest("li")!;
    expect(invoicesItem.querySelector('[data-sidebar="menu-badge"]')).toHaveTextContent("2");
  });

  it("shows no badge when nothing needs review", async () => {
    const invoices = freshInvoices().filter((i) => i.stage !== "needs_review");
    api.listInvoices.mockResolvedValue(invoices.map(strip));
    renderAt("/app/overview");
    await screen.findByRole("heading", { level: 1, name: "Overview" });
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalled());

    expect(document.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
  });

  it("still renders the menu without a badge when the invoice list fails", async () => {
    api.listInvoices.mockRejectedValue(new Error("Only finance staff can use the invoice worker."));
    renderAt("/app/overview");

    expect(await screen.findByRole("link", { name: "Invoices" })).toBeInTheDocument();
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalled());
    expect(document.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
  });

  it("hides the Admin link from non-admins and shows it to admins", async () => {
    const plain = renderAt("/app/overview");
    await screen.findByRole("link", { name: "Invoices" });
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    plain.unmount();

    authState.isAdmin = true;
    renderAt("/app/overview");
    expect(await screen.findByRole("link", { name: "Admin" })).toHaveAttribute("href", "/app/admin");
  });

  it("shows the signed-in user and a sign-out button", async () => {
    renderAt("/app/overview");

    expect(await screen.findByText("demo@appbuilder.ai")).toBeInTheDocument();
    expect(screen.getByText("Demo Reviewer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("navigates between pages from the menu", async () => {
    renderAt("/app/overview");
    await screen.findByRole("heading", { level: 1, name: "Overview" });

    fireEvent.click(screen.getByRole("link", { name: "Suppliers" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Suppliers" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Intake" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Submit an invoice" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Invoices" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
  });
});
