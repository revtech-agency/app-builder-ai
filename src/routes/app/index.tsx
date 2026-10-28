import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { getMyCompanies } from "@/lib/orders";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { data, error } = useQuery({ queryKey: ["my-companies"], queryFn: () => getMyCompanies() });
  const first = data?.[0];

  useEffect(() => {
    if (first) {
      navigate({ to: "/app/$companyId/orders", params: { companyId: first.id }, replace: true });
    }
  }, [first, navigate]);

  if (error) {
    return <p className="p-6 text-sm text-destructive">{(error as Error).message}</p>;
  }
  if (data && data.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Your account isn't linked to a client company yet — contact the order desk.
      </p>
    );
  }
  return <p className="p-6 text-sm text-muted-foreground">Loading your company…</p>;
}
