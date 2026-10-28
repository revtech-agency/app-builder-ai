import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatMoney } from "@/lib/format";
import { listOrders } from "@/lib/orders";
import type { Order } from "@/lib/orders";

export const Route = createFileRoute("/app/$companyId/orders")({
  head: () => ({ meta: [{ title: "Orders — AppBuilder.ai" }] }),
  component: OrdersPage,
});

function OrderCard({ order }: { order: Order }) {
  return (
    <Card>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-3 p-4 text-left">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{order.ref}</span>
              <StatusBadge status={order.stage} />
            </div>
            <p className="text-xs text-muted-foreground">
              Placed {formatDate(order.createdAt)} · Delivery {formatDate(order.deliveryDate)}
              {order.channel ? ` · via ${order.channel}` : ""}
            </p>
          </div>
          <span className="shrink-0 font-semibold tabular-nums">{formatMoney(order.amount)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 border-t pt-4">
            {order.exceptionReason && (
              <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
                {order.exceptionReason}
              </p>
            )}
            {order.lines.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Metres</TableHead>
                    <TableHead className="text-right">Packs</TableHead>
                    <TableHead className="text-right">Price/pack</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.name}</div>
                        {l.roundingNote && (
                          <div className="text-xs text-muted-foreground">{l.roundingNote}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.metres}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.packs}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(l.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No line items on this order.</p>
            )}
            {(order.quoteLink || order.quotePdf) && (
              <div className="flex flex-wrap gap-2">
                {order.quoteLink && (
                  <Button asChild variant="outline" size="sm">
                    <a href={order.quoteLink} target="_blank" rel="noreferrer">
                      <ExternalLink /> View quote{order.quoteNumber ? ` ${order.quoteNumber}` : ""}
                    </a>
                  </Button>
                )}
                {order.quotePdf && (
                  <Button asChild variant="outline" size="sm">
                    <a href={order.quotePdf} target="_blank" rel="noreferrer">
                      <ExternalLink /> Quote PDF
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function OrdersPage() {
  const { companyId } = Route.useParams();
  const orders = useQuery({
    queryKey: ["orders", companyId],
    queryFn: () => listOrders({ data: { companyId } }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your orders and where each one stands.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/$companyId/new-order" params={{ companyId }}>
            New order
          </Link>
        </Button>
      </div>

      {orders.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}
      {orders.error && (
        <p className="text-sm text-destructive">{(orders.error as Error).message}</p>
      )}
      {orders.data?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">You haven't placed any orders yet.</p>
            <Button asChild>
              <Link to="/app/$companyId/new-order" params={{ companyId }}>
                Place your first order
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {orders.data?.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    </div>
  );
}
