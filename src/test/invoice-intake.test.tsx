import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatEur } from "@/lib/format";
import type { IntakeResult } from "@/lib/invoice-types";

import { api, renderAt, resetApi } from "./invoice-harness";

vi.mock("@/lib/invoices", async () => (await import("./invoice-mocks")).api);
vi.mock("@/lib/auth", async () => (await import("./invoice-mocks")).mockAuthModule);

const result = (over: Partial<IntakeResult> = {}): IntakeResult => ({
  deal_id: "mock-3",
  stage: "needs_review",
  stage_label: "Needs review",
  document_type: "invoice",
  supplier_name: "TechNova Hardware SRL (demo)",
  invoice_number: "TN-55230",
  amount: 4815.8,
  match_result: "mismatch",
  approval_level: "team_lead",
  anomaly_flags: ["iban_mismatch"],
  exception_reason: "Docking stations invoiced at 199.00, PO price 185.00.",
  lines: [
    {
      name: "USB-C docking station",
      quantity: 20,
      price: 199,
      line_check: "price_off",
      line_check_note: "Invoiced 20 at EUR 199.00; PO price EUR 185.00 (+7.6%).",
    },
  ],
  ...over,
});

const textarea = () => screen.getByRole("textbox", { name: "Invoice or email text" });
const value = () => (textarea() as HTMLTextAreaElement).value;
const submitButton = () => screen.getByRole("button", { name: "Submit invoice" });

describe("Intake page", () => {
  beforeEach(() => resetApi());

  it("starts with an empty text box and a disabled submit button", async () => {
    renderAt("/app/intake");

    expect(await screen.findByRole("heading", { level: 1, name: "Submit an invoice" })).toBeInTheDocument();
    expect(textarea()).toHaveValue("");
    expect(submitButton()).toBeDisabled();
  });

  it("fills the text box from each sample button", async () => {
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.click(screen.getByRole("button", { name: "Clean invoice" }));
    expect(value()).toContain("Invoice OS-2026-1251");
    expect(submitButton()).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Wrong price and quantity" }));
    expect(value()).toContain("Invoice TN-55230");
    expect(value()).not.toContain("OS-2026-1251");

    fireEvent.click(screen.getByRole("button", { name: "Changed bank account" }));
    expect(value()).toContain("Factura CP-1010");
  });

  it("blocks an empty or whitespace-only submit", async () => {
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "   \n  " } });
    expect(submitButton()).toBeDisabled();
    fireEvent.click(submitButton());
    expect(api.submitInvoice).not.toHaveBeenCalled();
  });

  it("submits the trimmed text and renders the result card", async () => {
    api.submitInvoice.mockResolvedValue(
      result({ supplier_email_draft: "Dear TechNova,\n\nPlease confirm the docking station price." }),
    );
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "  Invoice TN-55230 for 20 docks  " } });
    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(api.submitInvoice).toHaveBeenCalledWith({ data: { text: "Invoice TN-55230 for 20 docks" } }),
    );
    expect(api.submitInvoice).toHaveBeenCalledTimes(1);

    const scope = within((await screen.findByText("Result")).closest("div.rounded-xl") as HTMLElement);
    expect(scope.getByText("needs review")).toBeInTheDocument();
    expect(scope.getByText("TechNova Hardware SRL (demo)")).toBeInTheDocument();
    expect(scope.getByText("TN-55230")).toBeInTheDocument();
    expect(scope.getByText(formatEur(4815.8))).toBeInTheDocument();
    expect(scope.getByText("mismatch")).toBeInTheDocument();
    // Flags, reason, line check and the supplier email draft.
    expect(scope.getByText("IBAN differs from the one on file")).toBeInTheDocument();
    expect(scope.getByText("Docking stations invoiced at 199.00, PO price 185.00.")).toBeInTheDocument();
    expect(scope.getByText("USB-C docking station")).toBeInTheDocument();
    expect(scope.getByText("price off")).toBeInTheDocument();
    expect(scope.getByText(/Invoiced 20 at EUR 199.00/)).toBeInTheDocument();
    expect(scope.getByText("Draft reply to the supplier")).toBeInTheDocument();
    expect(scope.getByText(/Please confirm the docking station price\./)).toBeInTheDocument();
    expect(scope.getByRole("link", { name: "Open invoice" })).toHaveAttribute(
      "href",
      "/app/invoices/mock-3",
    );
  });

  it("refreshes the invoice list after a successful submit", async () => {
    api.submitInvoice.mockResolvedValue(result());
    const { queryClient } = renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });
    // The sidebar already loaded the list once for its badge.
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalledTimes(1));

    fireEvent.change(textarea(), { target: { value: "Invoice X" } });
    fireEvent.click(submitButton());

    await screen.findByText("Result");
    await waitFor(() => expect(api.listInvoices).toHaveBeenCalledTimes(2));
    expect(queryClient.getQueryState(["invoices"])?.isInvalidated).toBe(false);
  });

  it("omits the optional parts of the result when there are none", async () => {
    api.submitInvoice.mockResolvedValue(
      result({
        deal_id: null,
        stage: "ready_to_approve",
        anomaly_flags: [],
        exception_reason: "",
        match_result: "",
        lines: [],
        supplier_name: "",
        invoice_number: "",
      }),
    );
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "Invoice Y" } });
    fireEvent.click(submitButton());

    await screen.findByText("Result");
    expect(screen.getByText("ready to approve")).toBeInTheDocument();
    expect(screen.getByText("No line items were extracted.")).toBeInTheDocument();
    expect(screen.queryByText("Draft reply to the supplier")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open invoice" })).not.toBeInTheDocument();
    expect(screen.queryByText("IBAN differs from the one on file")).not.toBeInTheDocument();
  });

  it("says when the invoice had already been processed", async () => {
    api.submitInvoice.mockResolvedValue(result({ already_processed: true, stage: "duplicate" }));
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "Invoice again" } });
    fireEvent.click(submitButton());

    expect(
      await screen.findByText("This invoice was already processed earlier, so nothing new was created."),
    ).toBeInTheDocument();
  });

  it("shows the busy state while the worker is running and blocks a double submit", async () => {
    let finish: (r: IntakeResult) => void = () => {};
    api.submitInvoice.mockReturnValue(new Promise<IntakeResult>((res) => (finish = res)));
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "Invoice Z" } });
    fireEvent.click(submitButton());

    const busy = await screen.findByRole("button", { name: "Processing…" });
    expect(busy).toBeDisabled();
    expect(screen.getByText(/This can take up to a minute/)).toBeInTheDocument();
    fireEvent.click(busy);
    expect(api.submitInvoice).toHaveBeenCalledTimes(1);

    finish(result());
    expect(await screen.findByText("Result")).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("shows an error message when the worker fails and no result card", async () => {
    api.submitInvoice.mockRejectedValue(new Error("The invoice worker took too long to answer. Please try again."));
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "Invoice Q" } });
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The invoice worker took too long to answer. Please try again.");
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
    // The person can retry.
    expect(submitButton()).toBeEnabled();
  });

  it("clears the previous error when the next submit succeeds", async () => {
    api.submitInvoice.mockRejectedValueOnce(new Error("Boom."));
    renderAt("/app/intake");
    await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

    fireEvent.change(textarea(), { target: { value: "Invoice Q" } });
    fireEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Boom.");

    api.submitInvoice.mockResolvedValueOnce(result());
    fireEvent.click(submitButton());
    expect(await screen.findByText("Result")).toBeInTheDocument();
    expect(screen.queryByText("Boom.")).not.toBeInTheDocument();
  });

  describe("PDF upload", () => {
    const pickFile = (file: File) => {
      const input = screen.getByLabelText("Upload a PDF invoice") as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
    };

    it("rejects a file that is not a PDF", async () => {
      renderAt("/app/intake");
      await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

      pickFile(new File(["hello"], "notes.txt", { type: "text/plain" }));

      expect(await screen.findByText("Please choose a PDF file.")).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
    });

    it("rejects a PDF larger than 5 MB", async () => {
      renderAt("/app/intake");
      await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

      const big = new File(["x"], "big.pdf", { type: "application/pdf" });
      Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
      pickFile(big);

      expect(await screen.findByText("That PDF is larger than 5 MB.")).toBeInTheDocument();
      expect(submitButton()).toBeDisabled();
    });

    it("sends a valid PDF as base64 with its file name and lets the person remove it", async () => {
      api.submitInvoice.mockResolvedValue(result());
      renderAt("/app/intake");
      await screen.findByRole("heading", { level: 1, name: "Submit an invoice" });

      pickFile(new File(["%PDF-1.4"], "inv-1.pdf", { type: "application/pdf" }));
      expect(await screen.findByText("inv-1.pdf")).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: "Remove PDF" }));
      expect(screen.queryByText("inv-1.pdf")).not.toBeInTheDocument();
      expect(submitButton()).toBeDisabled();

      pickFile(new File(["%PDF-1.4"], "inv-1.pdf", { type: "application/pdf" }));
      await screen.findByText("inv-1.pdf");
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(api.submitInvoice).toHaveBeenCalledWith({
          data: { pdfBase64: "JVBERi0xLjQ=", filename: "inv-1.pdf" },
        }),
      );
    });
  });
});
