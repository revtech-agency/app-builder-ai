import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/invoices";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant" | "error"; text: string };

const SUGGESTIONS = [
  "Why is this invoice in review?",
  "What does the PO say?",
  "Is the supplier's IBAN the one on file?",
];

export function ChatPanel({ invoiceId }: { invoiceId: string }) {
  // Stable per page visit and invoice, so the assistant keeps its conversation memory.
  const sessionId = useMemo(() => `invoice-${invoiceId}-${crypto.randomUUID()}`, [invoiceId]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (message: string) => askAssistant({ data: { sessionId, message, invoiceId } }),
    onSuccess: (res) => setMessages((m) => [...m, { role: "assistant", text: res.reply }]),
    onError: (e) =>
      setMessages((m) => [
        ...m,
        { role: "error", text: (e as Error).message || "The assistant could not answer." },
      ]),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, ask.isPending]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || ask.isPending) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setDraft("");
    ask.mutate(t);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" aria-hidden /> Ask about this invoice
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          The assistant is read-only: it explains the checks but can't approve, reject or change
          anything.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="max-h-96 min-h-24 space-y-2 overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label="Conversation with the invoice assistant"
        >
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                  m.role === "user" && "bg-primary text-primary-foreground",
                  m.role === "assistant" && "bg-muted",
                  m.role === "error" &&
                    "border border-destructive/25 bg-destructive/10 text-destructive",
                )}
              >
                {m.text}
              </p>
            </div>
          ))}
          {ask.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking…
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question…"
            aria-label="Your question"
            maxLength={4000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={ask.isPending || !draft.trim()}
            aria-label="Send"
          >
            <Send />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
