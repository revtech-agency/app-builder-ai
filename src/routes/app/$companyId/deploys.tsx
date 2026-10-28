import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listDeployments, listDomains, listPurchaseRequests, rollbackDeployment } from "@/lib/api";
import type { Deployment } from "@/lib/api";

export const Route = createFileRoute("/app/$companyId/deploys")({
  head: () => ({ meta: [{ title: "Deploys — AppBuilder.ai" }] }),
  component: DeploysPage,
});

function RollbackButton({ deployment, companyId }: { deployment: Deployment; companyId: string }) {
  const queryClient = useQueryClient();
  const rollback = useMutation({
    mutationFn: () => rollbackDeployment(deployment.id),
    onSuccess: () => {
      toast.success(`Rolled back to ${deployment.commit_sha.slice(0, 7)}`);
      queryClient.invalidateQueries({ queryKey: ["deployments", companyId] });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          Rollback
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Roll back to {deployment.commit_sha.slice(0, 7)}?</AlertDialogTitle>
          <AlertDialogDescription>
            This version becomes the live site and the current live version is superseded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => rollback.mutate()}>Roll back</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeploysPage() {
  const { companyId } = Route.useParams();
  const deployments = useQuery({
    queryKey: ["deployments", companyId],
    queryFn: () => listDeployments(companyId),
  });
  const domains = useQuery({
    queryKey: ["domains", companyId],
    queryFn: () => listDomains(companyId),
  });
  const purchases = useQuery({
    queryKey: ["purchases", companyId],
    queryFn: () => listPurchaseRequests(companyId),
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Deploys</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.commit_sha.slice(0, 7)}</TableCell>
                  <TableCell className="capitalize">{d.trigger.replace("_", " ")}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open deployment"
                      className="text-foreground hover:text-muted-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    {d.status === "superseded" && (
                      <RollbackButton deployment={d} companyId={companyId} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {domains.data?.map((d) => (
                <li key={d.domain} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.domain}</p>
                    <p className="text-xs capitalize text-muted-foreground">{d.purpose}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {purchases.data?.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.merchant}</p>
                    <p className="text-xs text-muted-foreground">${p.amount_usd.toFixed(2)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={p.status} />
                    {p.status === "awaiting_payment" && (
                      <Button size="sm" onClick={() => toast("Checkout would open here")}>
                        Pay
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
