import { createFileRoute, redirect } from "@tanstack/react-router";

// The old admin area is now split: client back office in the invoice desk, platform at /app/platform.
export const Route = createFileRoute("/app/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/app/platform", replace: true });
  },
});
