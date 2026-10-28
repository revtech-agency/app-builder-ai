import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { listUsersWithRoles, setRole } from "@/lib/back-office";

export const Route = createFileRoute("/app/admin/users")({
  head: () => ({ meta: [{ title: "Users & roles — AppBuilder.ai" }] }),
  component: UsersPage,
});

const ROLE_COLUMNS = [
  { role: "ap_reviewer", label: "Invoice reviewer" },
  { role: "admin", label: "Admin" },
] as const;

function UsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin-role-users"], queryFn: () => listUsersWithRoles() });
  const toggle = useMutation({
    mutationFn: (data: { userId: string; role: "admin" | "ap_reviewer"; enabled: boolean }) =>
      setRole({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-role-users"] }),
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Invoice reviewers work the invoice desk. Admins also manage purchase orders, suppliers and
        users.
      </p>
      {users.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {users.error && <p className="text-sm text-destructive">{(users.error as Error).message}</p>}
      {users.data && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                {ROLE_COLUMNS.map((c) => (
                  <TableHead key={c.role} className="text-center">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-[14rem] truncate font-medium">{u.email}</TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </TableCell>
                  {ROLE_COLUMNS.map((c) => {
                    const on = u.roles.includes(c.role);
                    return (
                      <TableCell key={c.role} className="text-center">
                        <Switch
                          checked={on}
                          aria-label={`${c.label} for ${u.email}`}
                          disabled={
                            toggle.isPending || (c.role === "admin" && on && u.id === user?.id)
                          }
                          onCheckedChange={(enabled) =>
                            toggle.mutate({ userId: u.id, role: c.role, enabled })
                          }
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
