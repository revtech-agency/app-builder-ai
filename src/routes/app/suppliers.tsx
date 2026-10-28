import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createSupplier, SUPPLIER_STATUSES, updateSupplier } from "@/lib/back-office";
import { formatDate } from "@/lib/format";
import { normIban } from "@/lib/invoice-rules";
import { listSuppliers } from "@/lib/invoices";
import type { SupplierRow } from "@/lib/invoices";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — AppBuilder.ai" }] }),
  component: SuppliersPage,
});

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending_onboarding: "Pending onboarding",
  blocked: "Blocked",
};

type Form = {
  name: string;
  domain: string;
  status: (typeof SUPPLIER_STATUSES)[number];
  vatId: string;
  iban: string;
  certificateValidUntil: string;
};

const toForm = (s: SupplierRow | null): Form => ({
  name: s?.name ?? "",
  domain: "",
  status: (s?.status as Form["status"]) ?? "pending_onboarding",
  vatId: s?.vatId ?? "",
  iban: s?.iban ?? "",
  certificateValidUntil: s?.certificateValidUntil?.slice(0, 10) ?? "",
});

function SupplierDialog({
  supplier,
  open,
  onOpenChange,
}: {
  supplier: SupplierRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(supplier));
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const ibanChanging = Boolean(supplier?.iban) && normIban(form.iban) !== normIban(supplier?.iban);

  const save = useMutation({
    mutationFn: async () => {
      const { domain, ...fields } = form;
      if (supplier) return updateSupplier({ data: { ...fields, companyId: supplier.id } });
      return createSupplier({ data: { ...fields, domain } });
    },
    onSuccess: () => {
      toast.success(supplier ? "Supplier saved" : "Supplier added");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit ${supplier.name}` : "New supplier"}</DialogTitle>
          <DialogDescription>
            Vendor master data the invoice worker checks every invoice against.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          {!supplier && (
            <div className="grid gap-1.5">
              <Label htmlFor="s-domain">Website domain (optional)</Label>
              <Input
                id="s-domain"
                placeholder="supplier.example.com"
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as Form["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-vat">VAT ID</Label>
              <Input
                id="s-vat"
                placeholder="RO10000001"
                value={form.vatId}
                onChange={(e) => set("vatId", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-iban">IBAN</Label>
            <Input
              id="s-iban"
              className="font-mono"
              value={form.iban}
              onChange={(e) => set("iban", e.target.value)}
            />
            {ibanChanging && (
              <p className="text-xs text-warning">
                Changing the IBAN keeps the old one and today's date. Invoices in the next 30 days
                go to review.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="s-cert">Tax certificate valid until</Label>
            <Input
              id="s-cert"
              type="date"
              value={form.certificateValidUntil}
              onChange={(e) => set("certificateValidUntil", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : supplier ? "Save" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Full IBAN only in the edit dialog; the list shows country code and last 4.
const maskIban = (iban: string | null) => {
  if (!iban) return "—";
  const clean = iban.replace(/\s+/g, "");
  return `${clean.slice(0, 2)}•• ••••${clean.slice(-4)}`;
};

const daysAgo = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

function SuppliersPage() {
  const { canManageDesk } = useAuth();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  // key remounts the dialog so its form starts from the chosen supplier
  const [editing, setEditing] = useState<{ key: number; supplier: SupplierRow | null } | null>(
    null,
  );
  const openDialog = (supplier: SupplierRow | null) => setEditing({ key: Date.now(), supplier });
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const all = suppliers.data ?? [];
  const counts: Record<string, number> = { all: all.length };
  for (const s of all) if (s.status) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const term = q.trim().toLowerCase();
  const rows = all.filter(
    (s) =>
      (tab === "all" || s.status === tab) &&
      (!term || [s.name, s.vatId].some((v) => v?.toLowerCase().includes(term))),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendor master data the worker checks every invoice against.
          </p>
        </div>
        {canManageDesk && (
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="size-4" />
            New supplier
          </Button>
        )}
      </div>
      <p className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        An IBAN changed in the last 30 days (a common fraud pattern) and an expired or missing tax
        certificate both hold the supplier's invoices for review.
      </p>
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto">
              {[
                { key: "all", label: "All" },
                ...SUPPLIER_STATUSES.map((k) => ({ key: k, label: STATUS_LABELS[k] })),
              ].map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                  {t.label}
                  <span className="font-mono text-xs text-muted-foreground">
                    {counts[t.key] ?? 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supplier or VAT ID"
            className="pl-9"
            aria-label="Search suppliers"
          />
        </div>
      </div>
      {suppliers.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {suppliers.error && (
        <p className="text-sm text-destructive">{(suppliers.error as Error).message}</p>
      )}
      {suppliers.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No suppliers yet.
          </CardContent>
        </Card>
      )}
      {!!suppliers.data?.length && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">VAT ID</TableHead>
                <TableHead className="hidden md:table-cell">IBAN</TableHead>
                <TableHead className="hidden sm:table-cell">Tax certificate valid until</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Open invoices</TableHead>
                {canManageDesk && (
                  <TableHead className="text-right">
                    <span className="sr-only">Edit</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No suppliers match this filter.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((s) => {
                const changed = daysAgo(s.ibanChangedOn);
                const recent = changed != null && changed <= 30;
                const expired = s.certificateValidUntil
                  ? new Date(s.certificateValidUntil).getTime() < Date.now()
                  : false;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.status ? <StatusBadge status={s.status} /> : "—"}</TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {s.vatId ?? "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {maskIban(s.iban)}
                      {recent && (
                        <div className="flex items-center gap-1 font-sans text-warning">
                          <TriangleAlert className="size-3" /> Changed {changed} days ago
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden whitespace-nowrap sm:table-cell",
                        (expired || !s.certificateValidUntil) && "font-medium text-destructive",
                      )}
                    >
                      {expired || !s.certificateValidUntil ? (
                        <span className="flex items-center gap-1">
                          <TriangleAlert className="size-3.5" />
                          {s.certificateValidUntil
                            ? `Expired (${formatDate(s.certificateValidUntil)})`
                            : "Missing"}
                        </span>
                      ) : (
                        formatDate(s.certificateValidUntil)
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {s.openInvoices}
                    </TableCell>
                    {canManageDesk && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDialog(s)}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {editing && (
        <SupplierDialog
          key={editing.key}
          supplier={editing.supplier}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  );
}
