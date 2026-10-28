import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Invoice — AppBuilder.ai" }] }),
  component: Page,
});

// Placeholder: replaced by the frontend work.
function Page() {
  return <p className="p-6 text-sm text-muted-foreground">Invoice (coming soon)</p>;
}
