import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, setAdmin } from "@/lib/admin";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/admin-old")({
  head: () => ({ meta: [{ title: "Admin (old) — AppBuilder.ai" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isAdmin,
  });
  const toggle = useMutation({
    mutationFn: (data: { userId: string; admin: boolean }) => setAdmin({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (err) => toast.error(err.message),
  });

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">This page is for admins only.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Admin (old)</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}
          {users.isError && <p className="text-sm text-destructive">{users.error.message}</p>}
          {users.data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.isAdmin ? "admin" : "user"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggle.isPending || (u.isAdmin && u.id === user?.id)}
                        onClick={() => toggle.mutate({ userId: u.id, admin: !u.isAdmin })}
                      >
                        {u.isAdmin ? "Remove admin" : "Make admin"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
