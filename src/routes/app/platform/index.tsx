import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/platform/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/platform/dashboard", replace: true });
  },
});
