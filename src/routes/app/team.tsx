import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { addTeamMember, listTeam, setTeamRole } from "@/lib/back-office";

export const Route = createFileRoute("/app/team")({
  head: () => ({ meta: [{ title: "Team — AppBuilder.ai" }] }),
  component: TeamPage,
});

const ROLE_COLUMNS = [
  { role: "ap_reviewer", label: "Invoice reviewer" },
  { role: "client_admin", label: "Admin" },
] as const;

function TeamPage() {
  const { user, canManageDesk } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam(), enabled: canManageDesk });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team"] });
  const add = useMutation({
    mutationFn: () => addTeamMember({ data: { email } }),
    onSuccess: () => {
      toast.success(`${email} can now use the invoice desk`);
      setEmail("");
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const toggle = useMutation({
    mutationFn: (data: {
      userId: string;
      role: "ap_reviewer" | "client_admin";
      enabled: boolean;
    }) => setTeamRole({ data }),
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });

  if (!canManageDesk) {
    return (
      <p className="p-6 text-sm text-muted-foreground">This page is for your team's admins.</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviewers work the invoice desk. Admins also edit purchase orders, suppliers and this
          team.
        </p>
      </div>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input
          type="email"
          required
          placeholder="colleague@bank.example.com"
          aria-label="Email of an existing account"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add reviewer"}
        </Button>
      </form>
      {team.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {team.error && <p className="text-sm text-destructive">{(team.error as Error).message}</p>}
      {team.data && (
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
              {team.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No one on the team yet.
                  </TableCell>
                </TableRow>
              )}
              {team.data.map((u) => (
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
                            toggle.isPending ||
                            (c.role === "client_admin" && on && u.id === user?.id)
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
