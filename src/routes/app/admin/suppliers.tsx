import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
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
import { createSupplier, SUPPLIER_STATUSES, updateSupplier } from "@/lib/back-office";
import { formatDate } from "@/lib/format";
import { normIban } from "@/lib/invoice-rules";
import { listSuppliers } from "@/lib/invoices";
import type { SupplierRow } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/admin/suppliers")({
  head: () => ({ meta: [{ title: "Manage suppliers — AppBuilder.ai" }] }),
  component: SuppliersAdminPage,
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

const daysAgo = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

function SuppliersAdminPage() {
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  // key remounts the dialog so its form starts from the chosen supplier
  const [editing, setEditing] = useState<{ key: number; supplier: SupplierRow | null } | null>(
    null,
  );
  const openDialog = (supplier: SupplierRow | null) => setEditing({ key: Date.now(), supplier });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add suppliers, block them, or update their bank details.
        </p>
        <Button size="sm" onClick={() => openDialog(null)}>
          <Plus className="size-4" />
          New supplier
        </Button>
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
                <TableHead className="hidden sm:table-cell">Certificate until</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Edit</span>
                </TableHead>
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
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {s.vatId ?? "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {s.iban ?? "—"}
                      {recent && (
                        <div className="font-sans text-warning">Changed {changed} days ago</div>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden whitespace-nowrap sm:table-cell",
                        expired && "font-medium text-destructive",
                      )}
                    >
                      {formatDate(s.certificateValidUntil)}
                      {expired && <span className="ml-1 text-xs">(expired)</span>}
                    </TableCell>
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
