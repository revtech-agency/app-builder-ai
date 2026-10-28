import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin — AppBuilder.ai" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/app/admin/overview", label: "Overview" },
  { to: "/app/admin/purchase-orders", label: "Purchase orders" },
  { to: "/app/admin/suppliers", label: "Suppliers" },
  { to: "/app/admin/users", label: "Users & roles" },
  { to: "/app/admin/rules", label: "Approval rules" },
] as const;

function AdminLayout() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">This page is for admins only.</p>;
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase orders, suppliers and the rules the invoice worker checks against.
        </p>
      </div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
            )}
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
