import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { getMyCompanies } from "@/lib/orders";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { data, error } = useQuery({ queryKey: ["my-companies"], queryFn: () => getMyCompanies() });
  const { canUseInvoiceDesk, rolesReady } = useAuth();
  const first = data?.[0];
  // Invoice desk users (and platform admins) start on the overview; order-worker clients on
  // their orders. Platform admins open client portals from Platform → Client portals.
  const toDesk = canUseInvoiceDesk;

  useEffect(() => {
    if (!rolesReady) return;
    if (toDesk) {
      navigate({ to: "/app/overview", replace: true });
    } else if (first) {
      navigate({ to: "/app/$companyId/orders", params: { companyId: first.id }, replace: true });
    }
  }, [first, toDesk, rolesReady, navigate]);

  if (error) {
    return <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>;
  }
  if (rolesReady && data && data.length === 0 && !toDesk) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Your account isn't linked to a client company yet — contact the order desk.
      </p>
    );
  }
  return <p className="p-6 text-sm text-muted-foreground">Loading your company…</p>;
}
