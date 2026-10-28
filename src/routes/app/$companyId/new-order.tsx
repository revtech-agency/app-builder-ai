import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import type { CartLine } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { evaluateLine, formatPieces, PIECE_METRES } from "@/lib/order-rules";
import { placeOrder, sendChat } from "@/lib/orders";

export const Route = createFileRoute("/app/$companyId/new-order")({
  head: () => ({ meta: [{ title: "New order — AppBuilder.ai" }] }),
  component: NewOrderPage,
});

type Message = { role: "user" | "assistant"; text: string };

const GREETING: Message = {
  role: "assistant",
  text: 'Hi! Type your order the way you would in an email, for example "MB52-T 3000 m, livrare joi". I\'ll build your cart on the right, and you can adjust it before placing the order.',
};

function lineTotals(line: CartLine) {
  if (!line.metres_per_pack) return null;
  const ev = evaluateLine({
    metres: line.metres,
    unitsPerPack: line.metres_per_pack,
    minSalePacks: line.min_sale_packs,
    packType: line.pack_type,
    stockPacks: line.stock_packs,
  });
  return { ev, total: line.price_per_pack != null ? ev.packs * line.price_per_pack : null };
}

function Chat({ companyId }: { companyId: string }) {
  const cart = useCart();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (message: string) =>
      sendChat({ data: { companyId, sessionId, message, cart: cart.lines } }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      cart.replaceCart(res.cart, res.delivery_date);
    },
    onError: (e) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Sorry, something went wrong: ${(e as Error).message}` },
      ]);
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, chat.isPending]);

  const send = () => {
    const message = draft.trim();
    if (!message || chat.isPending) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setDraft("");
    chat.mutate(message);
  };

  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader>
        <CardTitle className="text-base">Order assistant</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex max-h-[50vh] min-h-48 flex-col gap-3 overflow-y-auto lg:h-[55vh] lg:max-h-none">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg border bg-muted px-3 py-2 text-sm"
              }
            >
              {m.text}
            </div>
          ))}
          {chat.isPending && (
            <div className="mr-auto flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type your order… (Shift+Enter for a new line)"
            rows={2}
            className="min-h-0 flex-1"
          />
          <Button onClick={send} disabled={!draft.trim() || chat.isPending} aria-label="Send">
            <Send />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CartPanel({ companyId }: { companyId: string }) {
  const cart = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const total = cart.lines.reduce((sum, l) => sum + (lineTotals(l)?.total ?? 0), 0);
  const invalid = cart.lines.some((l) => !(l.metres > 0));

  const place = useMutation({
    mutationFn: () =>
      placeOrder({
        data: {
          companyId,
          deliveryDate: cart.deliveryDate,
          lines: cart.lines.map((l) => ({ sku: l.sku, metres: l.metres })),
        },
      }),
    onSuccess: async (res) => {
      const description = res.offerSent
        ? "Offer emailed to you."
        : res.offerError
          ? `Order saved, but the offer email failed: ${res.offerError}`
          : undefined;
      if (res.offerError) {
        toast.warning(`Order ${res.ref} — ${res.stageLabel}`, { description });
      } else {
        toast.success(`Order ${res.ref} — ${res.stageLabel}`, { description });
      }
      cart.clear();
      await queryClient.invalidateQueries({ queryKey: ["orders", companyId] });
      navigate({ to: "/app/$companyId/orders", params: { companyId } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Your cart</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/$companyId/inventory" params={{ companyId }}>
            Browse inventory
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {cart.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your cart is empty. Tell the assistant what you need, or browse the inventory.
          </p>
        ) : (
          <ul className="divide-y">
            {cart.lines.map((l) => {
              const t = lineTotals(l);
              return (
                <li key={l.sku} className="space-y-2 py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{l.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{l.sku}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${l.sku}`}
                      onClick={() => cart.removeLine(l.sku)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={l.metres ? formatPieces(l.metres) : ""}
                        onChange={(e) =>
                          cart.setMetres(l.sku, Number(e.target.value) * PIECE_METRES)
                        }
                        aria-label={`Pieces of ${l.sku}`}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">pc</span>
                    </div>
                    {t && (
                      <span className="text-sm tabular-nums">
                        {t.ev.packs} {l.pack_type ?? "pack"}
                        {t.ev.packs === 1 ? "" : "s"}
                        {l.price_per_pack != null && ` × ${formatMoney(l.price_per_pack)}`}
                      </span>
                    )}
                    {t?.total != null && (
                      <span className="ml-auto font-semibold tabular-nums">
                        {formatMoney(t.total)}
                      </span>
                    )}
                  </div>
                  {t?.ev.roundingNote && (
                    <p className="text-xs text-muted-foreground">{t.ev.roundingNote}</p>
                  )}
                  {t?.ev.stockNote && (
                    <Badge variant="outline" className="border-warning/30 text-warning">
                      {t.ev.stockNote}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2">
          <Label htmlFor="delivery-date">Delivery date</Label>
          <Input
            id="delivery-date"
            type="date"
            value={cart.deliveryDate}
            onChange={(e) => cart.setDeliveryDate(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
        </div>
        <Button
          className="w-full"
          disabled={cart.lines.length === 0 || invalid || place.isPending}
          onClick={() => place.mutate()}
        >
          {place.isPending && <Loader2 className="animate-spin" />} Place order
        </Button>
      </CardContent>
    </Card>
  );
}

function NewOrderPage() {
  const { companyId } = Route.useParams();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">New order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what you need, check the cart, then place the order.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Chat companyId={companyId} />
        <CartPanel companyId={companyId} />
      </div>
    </div>
  );
}
