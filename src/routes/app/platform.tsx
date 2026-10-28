import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/platform")({
  head: () => ({ meta: [{ title: "Platform — AppBuilder.ai" }] }),
  component: PlatformLayout,
});

const tabs = [
  { to: "/app/platform/dashboard", label: "Dashboard" },
  { to: "/app/platform/clients", label: "Client portals" },
  { to: "/app/platform/users", label: "Users & roles" },
] as const;

// AppBuilder.ai's own area: revenue, clients and accounts. No client documents here.
function PlatformLayout() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        This page is for AppBuilder.ai staff only.
      </p>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">AppBuilder.ai platform</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue, client portals and accounts across every client.
        </p>
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            activeProps={{ className: "border-primary font-semibold text-foreground" }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
