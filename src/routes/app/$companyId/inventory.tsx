import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { listInventory } from "@/lib/orders";
import type { InventoryItem } from "@/lib/orders";

export const Route = createFileRoute("/app/$companyId/inventory")({
  head: () => ({ meta: [{ title: "Inventory — AppBuilder.ai" }] }),
  component: InventoryPage,
});

const ALL = "__all__";

function StockBadge({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="text-muted-foreground">—</span>;
  if (stock <= 0) {
    return (
      <Badge variant="outline" className="border-destructive/25 bg-destructive/10 text-destructive">
        Out of stock
      </Badge>
    );
  }
  if (stock <= 5) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        Low · {stock}
      </Badge>
    );
  }
  return <span className="tabular-nums">{stock}</span>;
}

function AddToCart({ item }: { item: InventoryItem }) {
  const cart = useCart();
  const [metres, setMetres] = useState("");
  const value = Number(metres);

  const add = () => {
    if (!(value > 0)) return;
    cart.addLine({
      sku: item.sku,
      name: item.name,
      metres: value,
      metres_per_pack: item.unitsPerPack,
      min_sale_packs: item.minSalePacks ?? undefined,
      price_per_pack: item.price,
      stock_packs: item.stockPacks ?? undefined,
      pack_type: item.packType ?? undefined,
    });
    toast.success(`Added ${value} m of ${item.sku} to your cart`);
    setMetres("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        value={metres}
        onChange={(e) => setMetres(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="Metres"
        aria-label={`Metres of ${item.sku}`}
        className="w-24"
      />
      <Button size="sm" variant="outline" disabled={!(value > 0)} onClick={add}>
        Add to cart
      </Button>
    </div>
  );
}

function InventoryPage() {
  const { companyId } = Route.useParams();
  const cart = useCart();
  const inventory = useQuery({
    queryKey: ["inventory", companyId],
    queryFn: () => listInventory({ data: { companyId } }),
  });
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState(ALL);
  const [onlyOrderable, setOnlyOrderable] = useState(true);

  const families = useMemo(
    () =>
      [
        ...new Set((inventory.data ?? []).map((p) => p.casingFamily).filter(Boolean)),
      ].sort() as string[],
    [inventory.data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (inventory.data ?? []).filter(
      (p) =>
        (!onlyOrderable || p.orderable) &&
        (family === ALL || p.casingFamily === family) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }, [inventory.data, search, family, onlyOrderable]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse products and add them to your order.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/$companyId/new-order" params={{ companyId }}>
            New order{cart.lines.length > 0 ? ` (${cart.lines.length})` : ""}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU"
          aria-label="Search products"
          className="w-full sm:w-64"
        />
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Casing family">
            <SelectValue placeholder="Casing family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All families</SelectItem>
            {families.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="only-orderable" checked={onlyOrderable} onCheckedChange={setOnlyOrderable} />
          <Label htmlFor="only-orderable">Only items I can order</Label>
        </div>
      </div>

      {inventory.isLoading && <Skeleton className="h-64 w-full" />}
      {inventory.error && (
        <p className="text-sm text-destructive">{(inventory.error as Error).message}</p>
      )}
      {inventory.data && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead className="text-right">Price/pack</TableHead>
                  <TableHead className="text-right">Price/m</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="min-w-48 font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.unitsPerPack} m {p.packType ?? "pack"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.pricePerMetre != null ? formatMoney(p.pricePerMetre) : "—"}
                    </TableCell>
                    <TableCell>
                      <StockBadge stock={p.stockPacks} />
                    </TableCell>
                    <TableCell>
                      {p.orderable ? (
                        <AddToCart item={p} />
                      ) : (
                        <span className="whitespace-nowrap text-sm text-muted-foreground">
                          Quote on request
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No products match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
