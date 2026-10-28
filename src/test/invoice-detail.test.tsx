import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDate, formatEur } from "@/lib/format";

import { api, freshInvoices, renderAt, resetApi } from "./invoice-harness";

vi.mock("@/lib/invoices", async () => (await import("./invoice-mocks")).api);
vi.mock("@/lib/auth", async () => (await import("./invoice-mocks")).mockAuthModule);

const approveButton = () => screen.getByRole("button", { name: /^Approve$/ });
const rejectButton = () => screen.getByRole("button", { name: /^Reject$/ });
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

describe("Invoice detail", () => {
  beforeEach(() => resetApi());

  it("shows the key facts, the invoice header and loads by the id in the URL", async () => {
    renderAt("/app/invoices/mock-1");

    expect(await heading("OS-2026-1251")).toBeInTheDocument();
    expect(api.getInvoice).toHaveBeenCalledWith({ data: { invoiceId: "mock-1" } });
    expect(screen.getByText("Office Supplies Demo SRL (demo)")).toBeInTheDocument();
    expect(screen.getAllByText(formatEur(2250.6)).length).toBeGreaterThan(0);

    const fact = (label: string) => screen.getByText(label).closest("div")!;
    expect(within(fact("Invoice date")).getByText(formatDate("2026-10-26"))).toBeInTheDocument();
    expect(within(fact("Due date")).getByText(formatDate("2026-11-25"))).toBeInTheDocument();
    expect(within(fact("PO number")).getByText("PO-2026-0444")).toBeInTheDocument();
    expect(within(fact("IBAN on invoice")).getByText("RO12DEMO0000000000001001")).toBeInTheDocument();
    expect(within(fact("VAT")).getByText(formatEur(390.6))).toBeInTheDocument();
    expect(within(fact("Approval level")).getByText("Team lead (up to €5,000)")).toBeInTheDocument();
    expect(within(fact("Match result")).getByText("full match")).toBeInTheDocument();
    expect(within(fact("Extraction confidence")).getByText("95% (lowest field)")).toBeInTheDocument();
    // No flags and no reason: the attention box stays hidden.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All invoices/ })).toHaveAttribute("href", "/app/invoices");
  });

  it("shows line items with their checks and the audit ticks and crosses", async () => {
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    expect(screen.getByText("Process consulting, senior consultant day")).toBeInTheDocument();
    expect(screen.getByText("CONS-DAY")).toBeInTheDocument();
    expect(screen.getByText("matched")).toBeInTheDocument();
    expect(screen.getByText(formatEur(950))).toBeInTheDocument();

    expect(screen.getAllByLabelText("Passed")).toHaveLength(2);
    const failed = screen.getAllByLabelText("Failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]!.closest("li")).toHaveTextContent("IBAN");
    expect(failed[0]!.closest("li")).toHaveTextContent(
      "IBAN on the invoice differs from the one on file. Verify by phone before paying.",
    );
  });

  it("shows the flags and the exception reason in an alert", async () => {
    renderAt("/app/invoices/mock-2");
    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Needs attention")).toBeInTheDocument();
    expect(within(alert).getByText(/Verify by phone before paying/)).toBeInTheDocument();
    expect(within(alert).getByText("IBAN differs from the one on file")).toBeInTheDocument();
  });

  it("flags a price mismatch on the line and shows its note", async () => {
    renderAt("/app/invoices/mock-3");
    await heading("TN-55230");

    expect(screen.getByText("price off")).toBeInTheDocument();
    expect(
      screen.getByText("Invoiced 20 at EUR 199.00; PO price EUR 185.00 (+7.6%)."),
    ).toBeInTheDocument();
    expect(screen.getByText("mismatch")).toBeInTheDocument();
  });

  it("explains an empty invoice (no lines, no audit) and who approved it", async () => {
    renderAt("/app/invoices/mock-4");
    await heading("OS-2026-1187");

    expect(screen.getByText("No line items were extracted.")).toBeInTheDocument();
    expect(screen.getByText("No audit checks recorded.")).toBeInTheDocument();
    expect(screen.getByText("daniel@appbuilder.ai")).toBeInTheDocument();
  });

  it("disables Approve and Reject and shows the reason when canDecide is false", async () => {
    renderAt("/app/invoices/mock-5");
    await heading("SG-3340");

    expect(approveButton()).toBeDisabled();
    expect(rejectButton()).toBeDisabled();
    expect(
      screen.getByText("Head-of-department approval is needed for this amount."),
    ).toBeInTheDocument();

    fireEvent.click(approveButton());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(api.decideInvoice).not.toHaveBeenCalled();
  });

  it("hides the decision card once the invoice is approved", async () => {
    renderAt("/app/invoices/mock-4");
    await heading("OS-2026-1187");

    expect(screen.queryByRole("button", { name: /^Approve$/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Decision")).not.toBeInTheDocument();
  });

  it("asks for confirmation, then calls decideInvoice with approve and refreshes the data", async () => {
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");
    expect(approveButton()).toBeEnabled();

    fireEvent.click(approveButton());
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Approve this invoice?")).toBeInTheDocument();
    expect(within(dialog).getByText(/AP-2026-104 from Advisory Partners/)).toBeInTheDocument();
    // Nothing is sent before the person confirms.
    expect(api.decideInvoice).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(api.decideInvoice).toHaveBeenCalledWith({
        data: { invoiceId: "mock-2", decision: "approve" },
      }),
    );
    expect(api.decideInvoice).toHaveBeenCalledTimes(1);
    // The detail is re-fetched and the dialog closes.
    await waitFor(() => expect(api.getInvoice).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("calls decideInvoice with reject after confirmation", async () => {
    renderAt("/app/invoices/mock-3");
    await heading("TN-55230");

    fireEvent.click(rejectButton());
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Reject this invoice?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(api.decideInvoice).toHaveBeenCalledWith({
        data: { invoiceId: "mock-3", decision: "reject" },
      }),
    );
  });

  it("does not decide when the person cancels the confirmation", async () => {
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    fireEvent.click(approveButton());
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.decideInvoice).not.toHaveBeenCalled();
  });

  it("closes the dialog and leaves the page usable when the server refuses the decision", async () => {
    api.decideInvoice.mockRejectedValue(new Error("Head-of-department approval is needed."));
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    fireEvent.click(approveButton());
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Approve" }),
    );

    await waitFor(() => expect(api.decideInvoice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(approveButton()).toBeEnabled();
    // A refused decision must not trigger a refetch as if it had succeeded.
    expect(api.getInvoice).toHaveBeenCalledTimes(1);
  });

  it("shows the error message when the invoice cannot be loaded", async () => {
    renderAt("/app/invoices/does-not-exist");

    expect(await screen.findByText("Invoice not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All invoices/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Approve$/ })).not.toBeInTheDocument();
  });

  it("renders missing optional facts as dashes", async () => {
    const invoices = freshInvoices();
    const inv = invoices.find((i) => i.id === "mock-3")!;
    inv.anomalyFlags = [];
    inv.exceptionReason = null;
    inv.minFieldConfidence = null;
    inv.poNumber = null;
    inv.approvalLevel = null;
    inv.matchResult = null;
    resetApi(invoices);
    renderAt("/app/invoices/mock-3");
    await heading("TN-55230");

    for (const label of [
      "IBAN on invoice",
      "VAT",
      "PO number",
      "Approval level",
      "Match result",
      "Extraction confidence",
    ]) {
      expect(within(screen.getByText(label).closest("div")!).getByText("—")).toBeInTheDocument();
    }
  });
});

describe("Invoice chat panel", () => {
  beforeEach(() => resetApi());

  it("sends a typed question through askAssistant and shows the reply", async () => {
    api.askAssistant.mockResolvedValue({ reply: "The IBAN differs from the one on file." });
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), {
      target: { value: "  Why is it held?  " },
    });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    expect(await screen.findByText("The IBAN differs from the one on file.")).toBeInTheDocument();
    expect(api.askAssistant).toHaveBeenCalledTimes(1);
    const arg = api.askAssistant.mock.calls[0]![0] as {
      data: { sessionId: string; message: string; invoiceId: string };
    };
    expect(arg.data.message).toBe("Why is it held?");
    expect(arg.data.invoiceId).toBe("mock-2");
    expect(arg.data.sessionId).toMatch(/^invoice-mock-2-.+/);
    // The question is echoed in the log and the input is cleared.
    expect(within(screen.getByRole("log")).getByText("Why is it held?")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue("");
  });

  it("keeps the same session id across questions on one page", async () => {
    api.askAssistant.mockResolvedValue({ reply: "ok" });
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");
    const input = screen.getByRole("textbox", { name: "Your question" });

    fireEvent.change(input, { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("ok");
    fireEvent.change(input, { target: { value: "second" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(api.askAssistant).toHaveBeenCalledTimes(2));

    const ids = api.askAssistant.mock.calls.map(
      (c) => (c[0] as { data: { sessionId: string } }).data.sessionId,
    );
    expect(ids[0]).toBe(ids[1]);
  });

  it("sends a suggested question with one click", async () => {
    api.askAssistant.mockResolvedValue({ reply: "Because the price is off." });
    renderAt("/app/invoices/mock-3");
    await heading("TN-55230");

    fireEvent.click(screen.getByRole("button", { name: "Why is this invoice in review?" }));

    expect(await screen.findByText("Because the price is off.")).toBeInTheDocument();
    expect(
      (api.askAssistant.mock.calls[0]![0] as { data: { message: string } }).data.message,
    ).toBe("Why is this invoice in review?");
    // Suggestions disappear once the conversation has started.
    expect(screen.queryByRole("button", { name: "What does the PO say?" })).not.toBeInTheDocument();
  });

  it("shows an error bubble when the assistant fails, and lets the person ask again", async () => {
    api.askAssistant.mockRejectedValueOnce(
      new Error("The invoice assistant took too long to answer."),
    );
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("The invoice assistant took too long to answer."),
    ).toBeInTheDocument();

    api.askAssistant.mockResolvedValueOnce({ reply: "Second try worked." });
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), {
      target: { value: "again" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Second try worked.")).toBeInTheDocument();
  });

  it("does not send a blank question", async () => {
    renderAt("/app/invoices/mock-2");
    await heading("AP-2026-104");

    const input = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(api.askAssistant).not.toHaveBeenCalled();
  });
});
