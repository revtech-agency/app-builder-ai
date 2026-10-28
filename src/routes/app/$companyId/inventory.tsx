import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  PackageOpen,
  PackageX,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import { evaluateLine, formatPieces, PIECE_METRES } from "@/lib/order-rules";
import { listInventory } from "@/lib/orders";
import type { InventoryItem } from "@/lib/orders";

export const Route = createFileRoute("/app/$companyId/inventory")({
  head: () => ({ meta: [{ title: "Inventory — AppBuilder.ai" }] }),
  component: InventoryPage,
});

const ALL = "__all__";
const LOW_STOCK = 5;

type SortKey = "name" | "price" | "pricePerMetre" | "stock";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const sortValue = (p: InventoryItem, key: SortKey): string | number | null => {
  if (key === "name") return p.name.toLowerCase();
  if (key === "price") return p.price;
  if (key === "pricePerMetre") return p.pricePerMetre;
  return p.stockPacks;
};

// Missing values always sink to the bottom, whichever way the column is sorted.
function compareItems(a: InventoryItem, b: InventoryItem, { key, dir }: Sort) {
  const x = sortValue(a, key);
  const y = sortValue(b, key);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  const order = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
  return dir === "asc" ? order : -order;
}

function StockBadge({ stock }: { stock: number | null }) {
  if (stock == null) return <span className="text-muted-foreground">—</span>;
  if (stock <= 0) {
    return (
      <Badge variant="outline" className="border-destructive/25 bg-destructive/10 text-destructive">
        Out of stock
      </Badge>
    );
  }
  if (stock <= LOW_STOCK) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        Low · {stock}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/25 bg-success/10 text-success tabular-nums">
      {stock} packs
    </Badge>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      aria-sort={!active ? "none" : sort.dir === "asc" ? "ascending" : "descending"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex w-full items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${
          align === "right" ? "justify-end" : ""
        } ${active ? "text-foreground" : ""}`}
      >
        {label}
        <Icon
          className={`size-3.5 shrink-0 ${active ? "" : "opacity-40 group-hover:opacity-100"}`}
        />
      </button>
    </TableHead>
  );
}

const MAX_PIECES = 9999;

// "Add to cart" until the product is in the cart, then a − / + stepper with a trash button.
function AddToCart({ item }: { item: InventoryItem }) {
  const cart = useCart();
  const line = cart.lines.find((l) => l.sku === item.sku);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);
  const packWord = item.packType ?? "pack";

  if (!line) {
    return (
      <Button
        size="sm"
        onClick={() => {
          cart.addLine({
            sku: item.sku,
            name: item.name,
            metres: PIECE_METRES,
            metres_per_pack: item.unitsPerPack,
            min_sale_packs: item.minSalePacks ?? undefined,
            price_per_pack: item.price,
            stock_packs: item.stockPacks ?? undefined,
            pack_type: item.packType ?? undefined,
          });
          toast.success(`Added ${item.sku} to your cart`);
        }}
      >
        <ShoppingCart /> Add to cart
      </Button>
    );
  }

  // Same rounding / stock rules the order itself is checked against.
  const preview = evaluateLine({
    metres: line.metres,
    unitsPerPack: item.unitsPerPack,
    minSalePacks: item.minSalePacks,
    packType: item.packType,
    stockPacks: item.stockPacks,
  });

  const remove = () => {
    cart.removeLine(item.sku);
    toast.success(`Removed ${item.sku} from your cart`);
  };

  const startEditing = () => {
    cancelled.current = false;
    setDraft(formatPieces(line.metres));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (cancelled.current || draft.trim() === "") return;
    const pieces = Math.floor(Number(draft));
    if (!Number.isFinite(pieces)) return;
    if (pieces <= 0) remove();
    else cart.setMetres(item.sku, Math.min(pieces, MAX_PIECES) * PIECE_METRES);
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${item.sku} from cart`}
          onClick={remove}
        >
          <Trash2 />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          aria-label="One piece fewer"
          disabled={line.metres - PIECE_METRES <= 0}
          onClick={() => cart.setMetres(item.sku, line.metres - PIECE_METRES)}
        >
          <Minus />
        </Button>
        {editing ? (
          <Input
            autoFocus
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                cancelled.current = true;
                e.currentTarget.blur();
              }
            }}
            aria-label={`Pieces of ${item.sku}`}
            className="h-8 w-16 text-center tabular-nums"
          />
        ) : (
          <button
            type="button"
            title="Double-click to type a quantity"
            aria-label={`${formatPieces(line.metres)} pieces of ${item.sku}. Double-click or press Enter to edit.`}
            onDoubleClick={startEditing}
            onKeyDown={(e) => e.key === "Enter" && startEditing()}
            className="h-8 min-w-12 rounded-md px-2 text-center font-semibold tabular-nums outline-none select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {formatPieces(line.metres)}
          </button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          aria-label="One piece more"
          disabled={line.metres + PIECE_METRES > MAX_PIECES * PIECE_METRES}
          onClick={() => cart.setMetres(item.sku, line.metres + PIECE_METRES)}
        >
          <Plus />
        </Button>
      </div>

      <div className="text-right text-xs" aria-live="polite">
        <span className="font-medium tabular-nums">
          {formatPieces(line.metres)} pc · {formatMoney(preview.packs * item.price)}
        </span>
        {(preview.roundingNote || preview.stockNote) && (
          <div className="mt-0.5 flex items-start justify-end gap-1 text-warning">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>{[preview.roundingNote, preview.stockNote].filter(Boolean).join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductMeta({ item }: { item: InventoryItem }) {
  const parts = [
    item.casingFamily,
    item.calibreMm != null ? `${item.calibreMm} mm` : null,
    item.colour,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="mt-0.5 text-xs text-muted-foreground">{parts.join(" · ")}</div>;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }, (_, j) => (
            <TableCell key={j} className={j === 4 ? "hidden md:table-cell" : undefined}>
              <Skeleton className="h-5 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
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
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });

  const items = useMemo(() => inventory.data ?? [], [inventory.data]);

  const families = useMemo(
    () => [...new Set(items.map((p) => p.casingFamily).filter(Boolean))].sort() as string[],
    [items],
  );

  const stats = useMemo(
    () => ({
      orderable: items.filter((p) => p.orderable).length,
      low: items.filter(
        (p) => p.stockPacks != null && p.stockPacks > 0 && p.stockPacks <= LOW_STOCK,
      ).length,
      out: items.filter((p) => p.stockPacks != null && p.stockPacks <= 0).length,
    }),
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (p) =>
          (!onlyOrderable || p.orderable) &&
          (family === ALL || p.casingFamily === family) &&
          (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
      )
      .sort((a, b) => compareItems(a, b, sort));
  }, [items, search, family, onlyOrderable, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const filtered = search !== "" || family !== ALL || onlyOrderable;
  const clearFilters = () => {
    setSearch("");
    setFamily(ALL);
    setOnlyOrderable(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse products and add them to your order by the metre.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/$companyId/new-order" params={{ companyId }}>
            <ShoppingCart />
            New order
            {cart.lines.length > 0 && (
              <span className="ml-1 rounded-full bg-primary-foreground/15 px-1.5 text-xs tabular-nums">
                {cart.lines.length}
              </span>
            )}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<PackageOpen className="size-4" />}
          label="Products you can order"
          value={inventory.data ? `${stats.orderable} of ${items.length}` : "—"}
        />
        <StatTile
          icon={<AlertTriangle className="size-4 text-warning" />}
          label="Low stock"
          value={inventory.data ? stats.low : "—"}
        />
        <StatTile
          icon={<PackageX className="size-4 text-destructive" />}
          label="Out of stock"
          value={inventory.data ? stats.out : "—"}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU"
              aria-label="Search products"
              className="px-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
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
            <Switch
              id="only-orderable"
              checked={onlyOrderable}
              onCheckedChange={setOnlyOrderable}
            />
            <Label htmlFor="only-orderable">Only items I can order</Label>
          </div>
          {inventory.data && (
            <p className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
              Showing {rows.length} of {items.length}
            </p>
          )}
        </div>

        <CardContent className="p-0">
          {inventory.error ? (
            <div className="flex items-center gap-2 p-6 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {(inventory.error as Error).message}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <SortHead
                    label="Product"
                    sortKey="name"
                    sort={sort}
                    onSort={toggleSort}
                    className="pl-4"
                  />
                  <TableHead>SKU</TableHead>
                  <TableHead>Pack</TableHead>
                  <SortHead
                    label="Price/pack"
                    sortKey="price"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                  />
                  <SortHead
                    label="Price/m"
                    sortKey="pricePerMetre"
                    sort={sort}
                    onSort={toggleSort}
                    align="right"
                    className="hidden md:table-cell"
                  />
                  <SortHead label="Stock" sortKey="stock" sort={sort} onSort={toggleSort} />
                  <TableHead className="pr-4 text-right">Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.isLoading && <LoadingRows />}
                {rows.map((p) => (
                  <TableRow
                    key={p.id}
                    className={
                      p.stockPacks != null && p.stockPacks <= 0 ? "bg-muted/30" : undefined
                    }
                  >
                    <TableCell className="min-w-56 pl-4 align-top">
                      <div className="font-medium">{p.name}</div>
                      <ProductMeta item={p} />
                    </TableCell>
                    <TableCell className="align-top font-mono text-xs text-muted-foreground">
                      {p.sku}
                    </TableCell>
                    <TableCell className="align-top whitespace-nowrap">
                      {p.unitsPerPack} m {p.packType ?? "pack"}
                      {p.minSalePacks != null && p.minSalePacks > 1 && (
                        <div className="text-xs text-muted-foreground">
                          Min. {p.minSalePacks} packs
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top font-medium tabular-nums">
                      {formatMoney(p.price)}
                    </TableCell>
                    <TableCell className="hidden text-right align-top text-muted-foreground tabular-nums md:table-cell">
                      {p.pricePerMetre != null ? formatMoney(p.pricePerMetre) : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <StockBadge stock={p.stockPacks} />
                    </TableCell>
                    <TableCell className="pr-4 text-right align-top">
                      {p.orderable ? (
                        <AddToCart item={p} />
                      ) : (
                        <span className="text-sm whitespace-nowrap text-muted-foreground">
                          Quote on request
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {inventory.data && rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <PackageX className="size-8 text-muted-foreground" />
                        <p className="font-medium">No products match</p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search or casing family.
                        </p>
                        {filtered && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
