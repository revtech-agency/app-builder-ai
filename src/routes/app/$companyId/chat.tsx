import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { TurnCard } from "@/components/turn-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getChat, getCompany, listChats, sendFounderMessage } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$companyId/chat")({
  head: () => ({ meta: [{ title: "Chat — AppBuilder.ai" }] }),
  component: ChatPage,
});

function MessageBubble({ message }: { message: ChatMessage }) {
  const isFounder = message.role === "founder";
  return (
    <div className={cn("flex", isFounder ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm md:max-w-[70%]",
          isFounder ? "bg-primary text-primary-foreground" : "border bg-card",
        )}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.turn && <TurnCard turn={message.turn} />}
        <p
          className={cn(
            "mt-1.5 text-xs",
            isFounder ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function ChatPage() {
  const { companyId } = Route.useParams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const company = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
  });
  const chats = useQuery({ queryKey: ["chats", companyId], queryFn: () => listChats(companyId) });
  const chatId = chats.data?.[0]?.id;

  const chat = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getChat(chatId!),
    enabled: !!chatId,
    // Poll while an agent turn is still running.
    refetchInterval: (query) =>
      query.state.data?.messages.some((m) => m.turn?.status === "running") ? 1000 : false,
  });

  const send = useMutation({
    mutationFn: (text: string) => sendFounderMessage(chatId!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
    },
  });

  const messages = chat.data?.messages ?? [];
  const lastStepCount = messages.at(-1)?.turn?.steps.length;
  const running = messages.some((m) => m.turn?.status === "running");

  // A finished turn may have created a deployment, an ask.
  useEffect(() => {
    if (!running) {
      queryClient.invalidateQueries({ queryKey: ["asks", companyId] });
      queryClient.invalidateQueries({ queryKey: ["deployments", companyId] });
    }
  }, [running, companyId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastStepCount]);

  const submit = () => {
    const text = draft.trim();
    if (!text || !chatId || send.isPending) return;
    setDraft("");
    send.mutate(text);
  };

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col md:h-svh">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold">{company.data?.name ?? "…"}</h1>
        {company.data && <StatusBadge status={company.data.status} />}
        {company.data?.live_url && (
          <a
            href={company.data.live_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground"
          >
            {company.data.live_url.replace("https://", "")} <ExternalLink className="size-3" />
          </a>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-6">
        {chat.isLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t bg-background p-3 md:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Tell the builder what to do… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          className="min-h-0 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!draft.trim() || send.isPending}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
