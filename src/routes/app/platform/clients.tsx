import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyCompanies } from "@/lib/orders";

export const Route = createFileRoute("/app/platform/clients")({
  head: () => ({ meta: [{ title: "Client portals — AppBuilder.ai" }] }),
  component: ClientsPage,
});

// Order-worker clients (casings). Platform admins see every one and can open its portal.
function ClientsPage() {
  const companies = useQuery({ queryKey: ["my-companies"], queryFn: () => getMyCompanies() });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Open a client's portal to see it as they do: orders, new order and inventory.
      </p>
      {companies.isLoading && <Skeleton className="h-16 w-full" />}
      {companies.error && (
        <p className="text-sm text-destructive">{(companies.error as Error).message}</p>
      )}
      {companies.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No client portals yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {companies.data?.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <span className="font-medium">{c.name}</span>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/$companyId/orders" params={{ companyId: c.id }}>
                  Open portal <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
