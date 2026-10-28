import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { createPurchaseOrder, updatePurchaseOrder } from "@/lib/back-office";
import { formatMoney } from "@/lib/format";
import { poStageFor } from "@/lib/invoice-rules";
import { listPurchaseOrders, listSuppliers } from "@/lib/invoices";
import type { PurchaseOrder } from "@/lib/invoices";

export const Route = createFileRoute("/app/admin/purchase-orders")({
  head: () => ({ meta: [{ title: "Manage purchase orders — AppBuilder.ai" }] }),
  component: PurchaseOrdersAdminPage,
});

type LineForm = {
  key: string;
  id?: string;
  name: string;
  sku: string;
  quantity: string;
  price: string;
  receivedQuantity: string;
  deliveryNoteRef: string;
};

const blankLine = (): LineForm => ({
  key: crypto.randomUUID(),
  name: "",
  sku: "",
  quantity: "1",
  price: "",
  receivedQuantity: "0",
  deliveryNoteRef: "",
});

const toNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function PoDialog({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => listSuppliers(),
    enabled: !po,
  });
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [budgetCode, setBudgetCode] = useState(po?.budgetCode ?? "");
  const [requester, setRequester] = useState(po?.requester ?? "");
  const [closed, setClosed] = useState(po?.stage === "po_closed");
  const [lines, setLines] = useState<LineForm[]>(() =>
    po
      ? po.lines.map((l) => ({
          key: l.id,
          id: l.id,
          name: l.name,
          sku: l.sku,
          quantity: String(l.quantity),
          price: String(l.price),
          receivedQuantity: String(l.receivedQuantity),
          deliveryNoteRef: l.deliveryNoteRef ?? "",
        }))
      : [blankLine()],
  );
  const setLine = (key: string, patch: Partial<LineForm>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const parsed = lines.map((l) => ({
    id: l.id,
    name: l.name.trim(),
    sku: l.sku.trim(),
    quantity: toNum(l.quantity),
    price: toNum(l.price),
    receivedQuantity: toNum(l.receivedQuantity),
    deliveryNoteRef: l.deliveryNoteRef.trim(),
  }));
  const total = parsed.reduce((sum, l) => sum + l.quantity * l.price, 0);
  const stage = poStageFor(parsed, closed);

  const save = useMutation({
    mutationFn: async () => {
      if (po) {
        return updatePurchaseOrder({
          data: { dealId: po.id, budgetCode, requester, closed, lines: parsed },
        });
      }
      return createPurchaseOrder({
        data: {
          supplierId,
          poNumber,
          budgetCode,
          requester,
          lines: parsed.map(({ name, sku, quantity, price }) => ({ name, sku, quantity, price })),
        },
      });
    },
    onSuccess: () => {
      toast.success(po ? `${po.poNumber} saved` : `${poNumber} created`);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{po ? `Edit ${po.poNumber}` : "New purchase order"}</DialogTitle>
          <DialogDescription>
            {po
              ? `${po.supplierName ?? "Unknown supplier"} · record deliveries as they arrive.`
              : "Invoices are matched against this PO's lines and prices."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!po && !supplierId) {
              toast.error("Choose a supplier.");
              return;
            }
            save.mutate();
          }}
        >
          {!po && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={suppliers.isLoading ? "Loading…" : "Choose a supplier"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id} disabled={s.status === "blocked"}>
                        {s.name}
                        {s.status !== "approved" ? ` (${s.status?.replace(/_/g, " ")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="po-number">PO number</Label>
                <Input
                  id="po-number"
                  required
                  minLength={3}
                  placeholder="PO-2026-0450"
                  className="font-mono"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="po-budget">Budget code</Label>
              <Input
                id="po-budget"
                placeholder="IT-HW-2026"
                value={budgetCode}
                onChange={(e) => setBudgetCode(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="po-requester">Requested by</Label>
              <Input
                id="po-requester"
                placeholder="IT operations · Mihai"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lines</Label>
            {lines.map((l) => (
              <div
                key={l.key}
                className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-12"
              >
                <Input
                  aria-label="Item"
                  placeholder="Item"
                  required
                  className="col-span-2 sm:col-span-4"
                  value={l.name}
                  onChange={(e) => setLine(l.key, { name: e.target.value })}
                />
                <Input
                  aria-label="SKU"
                  placeholder="SKU"
                  required
                  className="font-mono sm:col-span-2"
                  value={l.sku}
                  onChange={(e) => setLine(l.key, { sku: e.target.value })}
                />
                <Input
                  aria-label="Quantity"
                  placeholder="Qty"
                  inputMode="decimal"
                  required
                  className="sm:col-span-2"
                  value={l.quantity}
                  onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                />
                <Input
                  aria-label="Unit price"
                  placeholder="Unit price €"
                  inputMode="decimal"
                  required
                  className="sm:col-span-3"
                  value={l.price}
                  onChange={(e) => setLine(l.key, { price: e.target.value })}
                />
                {!l.id && lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    className="justify-self-end sm:col-span-1"
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <span className="hidden sm:col-span-1 sm:block" />
                )}
                {po && (
                  <>
                    <div className="col-span-1 grid gap-1 sm:col-span-4">
                      <Label className="text-xs text-muted-foreground">Received</Label>
                      <Input
                        aria-label="Received quantity"
                        inputMode="decimal"
                        value={l.receivedQuantity}
                        onChange={(e) => setLine(l.key, { receivedQuantity: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 grid gap-1 sm:col-span-8">
                      <Label className="text-xs text-muted-foreground">Delivery note</Label>
                      <Input
                        aria-label="Delivery note reference"
                        placeholder="DN-…"
                        className="font-mono"
                        value={l.deliveryNoteRef}
                        onChange={(e) => setLine(l.key, { deliveryNoteRef: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Stage</span>
              <StatusBadge status={stage} />
            </div>
            <span className="font-semibold tabular-nums">Total {formatMoney(total)}</span>
          </div>
          {po && (
            <div className="flex items-center gap-2">
              <Switch id="po-closed" checked={closed} onCheckedChange={setClosed} />
              <Label htmlFor="po-closed">Close this PO (fully invoiced and paid)</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : po ? "Save" : "Create PO"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseOrdersAdminPage() {
  const pos = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders() });
  // key remounts the dialog so its form starts from the chosen PO
  const [editing, setEditing] = useState<{ key: number; po: PurchaseOrder | null } | null>(null);
  const openDialog = (po: PurchaseOrder | null) => setEditing({ key: Date.now(), po });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Raise POs and record deliveries. The stage follows what's been received.
        </p>
        <Button size="sm" onClick={() => openDialog(null)}>
          <Plus className="size-4" />
          New PO
        </Button>
      </div>
      {pos.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {pos.error && <p className="text-sm text-destructive">{(pos.error as Error).message}</p>}
      {pos.data?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No purchase orders yet.
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {pos.data?.map((po) => {
          const ordered = po.lines.reduce((s, l) => s + l.quantity, 0);
          const received = po.lines.reduce(
            (s, l) => s + Math.min(l.receivedQuantity, l.quantity),
            0,
          );
          return (
            <Card key={po.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {po.poNumber ?? "No PO number"}
                    </span>
                    <StatusBadge status={po.stage} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {po.supplierName ?? "Unknown supplier"}
                    {po.budgetCode ? ` · Budget ${po.budgetCode}` : ""}
                    {po.requester ? ` · ${po.requester}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {po.lines.length} {po.lines.length === 1 ? "line" : "lines"} · received{" "}
                    {received} of {ordered}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(po.amount)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openDialog(po)}
                  aria-label={`Edit ${po.poNumber}`}
                >
                  <Pencil className="size-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {editing && <PoDialog key={editing.key} po={editing.po} onClose={() => setEditing(null)} />}
    </div>
  );
}
