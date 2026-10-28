import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  answerAsk,
  approveDraft,
  listAsks,
  listDrafts,
  listInbox,
  rejectDraft,
  updateDraft,
} from "@/lib/api";
import type { FounderAsk, MailMessage } from "@/lib/api";

export const Route = createFileRoute("/app/$companyId/inbox")({
  head: () => ({ meta: [{ title: "Inbox — AppBuilder.ai" }] }),
  component: InboxPage,
});

function AskCard({ ask, companyId }: { ask: FounderAsk; companyId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState(ask.suggested_reply);
  const answer = useMutation({
    mutationFn: () => answerAsk(ask.id, reply),
    onSuccess: () => {
      toast.success("Answer sent to the builder");
      queryClient.invalidateQueries({ queryKey: ["asks", companyId] });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{ask.title}</CardTitle>
          <StatusBadge status={ask.priority} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{ask.question}</p>
        <Textarea
          aria-label="Your answer"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
        />
        <Button
          size="sm"
          disabled={!reply.trim() || answer.isPending}
          onClick={() => answer.mutate()}
        >
          Send answer
        </Button>
      </CardContent>
    </Card>
  );
}

function DraftCard({ draft, companyId }: { draft: MailMessage; companyId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body_text);

  const done = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["drafts", companyId] });
  };
  const approve = useMutation({
    mutationFn: () => approveDraft(draft.id),
    onSuccess: () => done("Draft approved"),
  });
  const reject = useMutation({
    mutationFn: () => rejectDraft(draft.id),
    onSuccess: () => done("Draft rejected"),
  });
  const save = useMutation({
    mutationFn: () => updateDraft(draft.id, { subject, body_text: body }),
    onSuccess: () => {
      setEditing(false);
      done("Draft updated");
    },
  });
  const busy = approve.isPending || reject.isPending || save.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{draft.subject}</CardTitle>
          <StatusBadge status="draft" />
        </div>
        <p className="text-xs text-muted-foreground">To {draft.to}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <Input
              aria-label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              aria-label="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
            />
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{draft.body_text}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => save.mutate()}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" disabled={busy} onClick={() => approve.mutate()}>
                Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => reject.mutate()}>
                Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MailRow({ mail, onOpen }: { mail: MailMessage; onOpen: () => void }) {
  const when = mail.received_at ?? mail.sent_at;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent/50"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {mail.direction === "in" ? mail.from : mail.to}
          </span>
          {when && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(when), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">{mail.subject}</span>
          {mail.dmarc_pass === false && (
            <Badge variant="outline" className="shrink-0 border-destructive/30 text-destructive">
              <ShieldAlert className="mr-1 size-3" /> DMARC failed
            </Badge>
          )}
        </div>
      </button>
    </li>
  );
}

function MailList({
  mails,
  empty,
  onOpen,
}: {
  mails: MailMessage[];
  empty: string;
  onOpen: (m: MailMessage) => void;
}) {
  if (mails.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <Card>
      <ul className="divide-y">
        {mails.map((m) => (
          <MailRow key={m.id} mail={m} onOpen={() => onOpen(m)} />
        ))}
      </ul>
    </Card>
  );
}

function InboxPage() {
  const { companyId } = Route.useParams();
  const [selected, setSelected] = useState<MailMessage | null>(null);

  const asks = useQuery({ queryKey: ["asks", companyId], queryFn: () => listAsks(companyId) });
  const drafts = useQuery({
    queryKey: ["drafts", companyId],
    queryFn: () => listDrafts(companyId),
  });
  const inbox = useQuery({ queryKey: ["inbox", companyId], queryFn: () => listInbox(companyId) });

  const openAsks = asks.data?.filter((a) => a.status === "open") ?? [];
  const openDrafts = drafts.data?.filter((d) => d.status === "draft") ?? [];
  const sent = drafts.data?.filter((d) => d.status === "sent" || d.status === "approved") ?? [];
  const needsYou = openAsks.length + openDrafts.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Inbox</h1>
      <Tabs defaultValue="needs-you">
        <TabsList>
          <TabsTrigger value="needs-you">
            Needs you{needsYou > 0 ? ` (${needsYou})` : ""}
          </TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="needs-you" className="space-y-3">
          {needsYou === 0 && <p className="text-sm text-muted-foreground">You're all caught up.</p>}
          {openAsks.map((a) => (
            <AskCard key={a.id} ask={a} companyId={companyId} />
          ))}
          {openDrafts.map((d) => (
            <DraftCard key={d.id} draft={d} companyId={companyId} />
          ))}
        </TabsContent>

        <TabsContent value="inbox">
          <MailList mails={inbox.data ?? []} empty="No inbound mail yet." onOpen={setSelected} />
        </TabsContent>

        <TabsContent value="sent">
          <MailList mails={sent} empty="Nothing sent yet." onOpen={setSelected} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <DialogDescription>
                  From {selected.from} to {selected.to}
                  {(selected.received_at ?? selected.sent_at) &&
                    ` · ${format(new Date((selected.received_at ?? selected.sent_at)!), "PPp")}`}
                </DialogDescription>
              </DialogHeader>
              {selected.dmarc_pass === false && (
                <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  <ShieldAlert className="size-4" /> This sender failed DMARC. It may be spoofed.
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">{selected.body_text}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
