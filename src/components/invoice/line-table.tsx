import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEur } from "@/lib/format";
import type { LineCheck } from "@/lib/invoice-types";

export type LineRow = {
  key: string;
  name: string;
  sku?: string | null;
  quantity: number;
  price: number;
  check: LineCheck | null;
  note: string | null;
};

export function LineTable({ lines }: { lines: LineRow[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No line items were extracted.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Check</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <TableRow key={l.key}>
            <TableCell>
              <div className="font-medium">{l.name}</div>
              {l.sku && <div className="font-mono text-xs text-muted-foreground">{l.sku}</div>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">{formatEur(l.price)}</TableCell>
            <TableCell className="min-w-48 whitespace-normal">
              {l.check ? (
                <StatusBadge status={l.check} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {l.note && <p className="mt-1 text-xs text-muted-foreground">{l.note}</p>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
