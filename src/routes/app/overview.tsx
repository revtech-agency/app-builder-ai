import { createFileRoute } from "@tanstack/react-router";

import { P2pOverview } from "@/components/p2p-overview";

export const Route = createFileRoute("/app/overview")({
  head: () => ({ meta: [{ title: "Overview — AppBuilder.ai" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <P2pOverview />
    </div>
  );
}
