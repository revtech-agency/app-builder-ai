import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { listSuppliers } from "@/lib/invoices";

export const Route = createFileRoute("/app/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — AppBuilder.ai" }] }),
  component: SuppliersPage,
});

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function maskIban(iban: string | null) {
  if (!iban) return "—";
  const clean = iban.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 2)}•• ••••${clean.slice(-4)}`;
}

function changedRecently(value: string | null) {
  if (!value) return false;
  const t = new Date(value).getTime();
  return !Number.isNaN(t) && Date.now() - t <= THIRTY_DAYS && t <= Date.now() + 86400000;
}

function SuppliersPage() {
  const suppliers = useQuery({ queryKey: ["invoice-suppliers"], queryFn: () => listSuppliers() });
  const rows = suppliers.data;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Suppliers</h1>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <span>
          Warnings: an IBAN changed in the last 30 days (a common fraud pattern) and an expired tax
          certificate both hold the supplier's invoices for review. IBANs are shown masked.
        </span>
      </p>

      {suppliers.isLoading && <p className="text-sm text-muted-foreground">Loading suppliers…</p>}
      {suppliers.isError && <p className="text-sm text-destructive">{suppliers.error.message}</p>}
      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No suppliers yet.</p>
      )}

      {rows && rows.length > 0 && (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>VAT ID</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Tax certificate valid until</TableHead>
                  <TableHead className="text-right">Open invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const recent = changedRecently(s.ibanChangedOn);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap font-medium">{s.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.vatId ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono text-xs">{maskIban(s.iban)}</span>
                        {s.previousIban && (
                          <div
                            className={
                              recent
                                ? "mt-1 flex items-center gap-1 text-xs font-medium text-warning"
                                : "mt-1 text-xs text-muted-foreground"
                            }
                          >
                            {recent && <AlertTriangle className="size-3" />}
                            <span>
                              was <span className="font-mono">{maskIban(s.previousIban)}</span>,
                              changed {formatDate(s.ibanChangedOn)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {s.certificateExpired ? (
                          <span className="inline-flex items-center gap-1 font-medium text-warning">
                            <AlertTriangle className="size-3.5" />
                            Expired
                            {s.taxCertificateValidUntil &&
                              ` (${formatDate(s.taxCertificateValidUntil)})`}
                          </span>
                        ) : (
                          formatDate(s.taxCertificateValidUntil)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.openInvoices > 0 ? (
                          <Link to="/app/invoices" className="underline-offset-2 hover:underline">
                            {s.openInvoices}
                          </Link>
                        ) : (
                          0
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
