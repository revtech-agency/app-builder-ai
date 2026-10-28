import { createFileRoute } from "@tanstack/react-router";

import { P2pOverview } from "@/components/p2p-overview";

export const Route = createFileRoute("/app/admin/overview")({
  head: () => ({ meta: [{ title: "Overview — AppBuilder.ai" }] }),
  component: P2pOverview,
});
