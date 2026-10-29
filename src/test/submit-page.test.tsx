import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ isDemo: true }));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/invoices", () => ({ submitDocument: vi.fn() }));

import { Route } from "@/routes/app/invoices/new";

function renderPage() {
  const Page = Route.options.component!;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Page />
    </QueryClientProvider>,
  );
}

const textBox = () => screen.getByLabelText("Document text") as HTMLTextAreaElement;
const loaded = () => screen.queryAllByRole("button", { pressed: true }).map((b) => b.textContent);

describe("Submit document", () => {
  beforeEach(() => {
    auth.isDemo = true;
  });

  it("opens with a sample loaded for the demo account and the PDF upload tucked away", () => {
    renderPage();
    expect(textBox().value).toContain("Invoice OS-2026-1251");
    expect(loaded()).toEqual([expect.stringContaining("Clean invoice — loaded")]);
    expect(screen.queryByRole("button", { name: "Choose PDF" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Use your own PDF instead/ }));
    expect(screen.getByRole("button", { name: "Choose PDF" })).toBeTruthy();
  });

  it("marks the sample that was picked, and none once the text is edited", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Price and quantity off/ }));
    expect(loaded()).toEqual([expect.stringContaining("Price and quantity off — loaded")]);

    fireEvent.change(textBox(), { target: { value: "my own text" } });
    expect(loaded()).toEqual([]);
  });

  it("starts empty with the upload visible for a real reviewer", () => {
    auth.isDemo = false;
    renderPage();
    expect(textBox().value).toBe("");
    expect(screen.getByRole("button", { name: "Choose PDF" })).toBeTruthy();
  });
});
