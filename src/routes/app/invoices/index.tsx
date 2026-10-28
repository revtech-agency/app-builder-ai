import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — AppBuilder.ai" }] }),
  component: Page,
});

// Placeholder: replaced by the frontend work.
function Page() {
  return <p className="p-6 text-sm text-muted-foreground">Invoices (coming soon)</p>;
}
