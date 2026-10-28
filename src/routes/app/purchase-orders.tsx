import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { listPurchaseOrders } from "@/lib/invoices";
import type { PurchaseOrder } from "@/lib/invoices";

export const Route = createFileRoute("/app/purchase-orders")({
  head: () => ({ meta: [{ title: "Purchase orders — AppBuilder.ai" }] }),
  component: PurchaseOrdersPage,
});

function PoCard({ po }: { po: PurchaseOrder }) {
  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-3 p-4 text-left">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">
                {po.poNumber ?? "No PO number"}
              </span>
              <StatusBadge status={po.stage} />
            </div>
            <p className="text-xs text-muted-foreground">
              {po.supplierName ?? "Unknown supplier"}
              {po.budgetCode ? ` · Budget ${po.budgetCode}` : ""}
              {po.requester ? ` · ${po.requester}` : ""}
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(po.amount)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            {po.lines.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.sku}
                          {l.deliveryNoteRef ? ` · ${l.deliveryNoteRef}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.receivedQuantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Math.max(l.quantity - l.receivedQuantity, 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.price)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No lines on this purchase order.</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function PurchaseOrdersPage() {
  const pos = useQuery({ queryKey: ["purchase-orders"], queryFn: () => listPurchaseOrders() });
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Purchase orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What was ordered and what has been delivered.
        </p>
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
        {pos.data?.map((p) => (
          <PoCard key={p.id} po={p} />
        ))}
      </div>
    </div>
  );
}
