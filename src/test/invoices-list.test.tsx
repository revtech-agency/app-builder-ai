import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api, renderAt, resetApi } from "./invoice-harness";

vi.mock("@/lib/invoices", async () => (await import("./invoice-mocks")).api);
vi.mock("@/lib/auth", async () => (await import("./invoice-mocks")).mockAuthModule);

const REFS = ["OS-2026-1251", "AP-2026-104", "TN-55230", "OS-2026-1187", "SG-3340"];

function visibleRefs() {
  return REFS.filter((r) => screen.queryByRole("link", { name: r }));
}

describe("Invoices list", () => {
  beforeEach(() => resetApi());

  it("lists every fixture invoice with supplier, amount, flags and links to the detail page", async () => {
    renderAt("/app/invoices");

    expect(await screen.findByRole("link", { name: "OS-2026-1251" })).toHaveAttribute(
      "href",
      "/app/invoices/mock-1",
    );
    expect(visibleRefs()).toEqual(REFS);
    expect(api.listInvoices).toHaveBeenCalledTimes(1);

    const row = screen.getByRole("link", { name: "AP-2026-104" }).closest("tr")!;
    expect(within(row).getByText("Advisory Partners Demo SRL (demo)")).toBeInTheDocument();
    expect(within(row).getByText("€4,598.00")).toBeInTheDocument();
    expect(within(row).getByText("IBAN differs from the one on file")).toBeInTheDocument();
    expect(within(row).getByText("needs review")).toBeInTheDocument();
    expect(screen.getByText("5 invoices · 2 need review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Submit an invoice" })).toHaveAttribute(
      "href",
      "/app/intake",
    );
  });

  it("shows a count on every stage chip, including empty stages", async () => {
    renderAt("/app/invoices");
    await screen.findByRole("link", { name: "OS-2026-1251" });

    expect(screen.getByRole("button", { name: "All (5)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Needs review (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ready to approve (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Waiting on supplier (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approved for payment (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejected (0)" })).toBeInTheDocument();
  });

  it("filters rows by stage chip and goes back to all", async () => {
    renderAt("/app/invoices");
    await screen.findByRole("link", { name: "OS-2026-1251" });

    fireEvent.click(screen.getByRole("button", { name: "Needs review (2)" }));
    expect(visibleRefs()).toEqual(["AP-2026-104", "TN-55230"]);
    expect(screen.getByRole("button", { name: "Needs review (2)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Approved for payment (1)" }));
    expect(visibleRefs()).toEqual(["OS-2026-1187"]);

    fireEvent.click(screen.getByRole("button", { name: "Duplicate (0)" }));
    expect(visibleRefs()).toEqual([]);
    expect(screen.getByText("No invoices match your filters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All (5)" }));
    expect(visibleRefs()).toEqual(REFS);
  });

  it("searches by supplier name and by invoice number, case-insensitively", async () => {
    renderAt("/app/invoices");
    await screen.findByRole("link", { name: "OS-2026-1251" });
    const box = screen.getByRole("textbox", { name: "Search supplier or invoice number" });

    fireEvent.change(box, { target: { value: "technova" } });
    expect(visibleRefs()).toEqual(["TN-55230"]);

    fireEvent.change(box, { target: { value: "os-2026-11" } });
    expect(visibleRefs()).toEqual(["OS-2026-1187"]);

    fireEvent.change(box, { target: { value: "Office Supplies" } });
    expect(visibleRefs()).toEqual(["OS-2026-1251", "OS-2026-1187"]);

    fireEvent.change(box, { target: { value: "  sg-3340  " } });
    expect(visibleRefs()).toEqual(["SG-3340"]);

    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByText("No invoices match your filters.")).toBeInTheDocument();
  });

  it("combines the stage chip with the search box", async () => {
    renderAt("/app/invoices");
    await screen.findByRole("link", { name: "OS-2026-1251" });

    fireEvent.click(screen.getByRole("button", { name: "Needs review (2)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search supplier or invoice number" }), {
      target: { value: "advisory" },
    });
    expect(visibleRefs()).toEqual(["AP-2026-104"]);
  });

  it("says there are no invoices when the list is empty", async () => {
    api.listInvoices.mockResolvedValue([]);
    renderAt("/app/invoices");

    expect(await screen.findByText("No invoices yet.")).toBeInTheDocument();
    expect(screen.getByText("0 invoices · 0 need review")).toBeInTheDocument();
  });

  it("shows the server's error message instead of a table when loading fails", async () => {
    api.listInvoices.mockRejectedValue(new Error("Only finance staff can use the invoice worker."));
    renderAt("/app/invoices");

    expect(
      await screen.findByText("Only finance staff can use the invoice worker."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
