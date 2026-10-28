import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listSuppliers } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — AppBuilder.ai" }] }),
  component: SuppliersPage,
});

const maskIban = (iban: string | null) => {
  if (!iban) return "—";
  const clean = iban.replace(/\s+/g, "");
  return `•••• ${clean.slice(-4)}`;
};

const daysAgo = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

function SuppliersPage() {
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vendor master data the worker checks against.</p>
      </div>
      {suppliers.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {suppliers.error && <p className="text-sm text-destructive">{(suppliers.error as Error).message}</p>}
      {suppliers.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No suppliers yet.</CardContent>
        </Card>
      )}
      {!!suppliers.data?.length && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>VAT ID</TableHead>
                <TableHead>IBAN</TableHead>
                <TableHead>IBAN changed</TableHead>
                <TableHead>Certificate valid until</TableHead>
                <TableHead className="text-right">Open invoices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.data.map((s) => {
                const changed = daysAgo(s.ibanChangedOn);
                const recent = changed != null && changed <= 30;
                const expired = s.certificateValidUntil
                  ? new Date(s.certificateValidUntil).getTime() < Date.now()
                  : false;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.status ? <StatusBadge status={s.status} /> : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.vatId ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{maskIban(s.iban)}</TableCell>
                    <TableCell className={cn("whitespace-nowrap", recent && "font-medium text-warning")}>
                      {formatDate(s.ibanChangedOn)}
                      {recent && <span className="ml-1 text-xs">({changed} days ago)</span>}
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap", expired && "font-medium text-destructive")}>
                      {formatDate(s.certificateValidUntil)}
                      {expired && <span className="ml-1 text-xs">(expired)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.openInvoices}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
