import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { getCompanies } from "@/lib/api";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["companies"], queryFn: getCompanies });
  const first = data?.[0];

  useEffect(() => {
    if (first) {
      navigate({ to: "/app/$companyId/chat", params: { companyId: first.id }, replace: true });
    }
  }, [first, navigate]);

  return <p className="p-6 text-sm text-muted-foreground">Loading your companies…</p>;
}
