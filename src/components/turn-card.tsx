import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import type { StepStatus, Turn } from "@/lib/api";

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-warning" />;
  if (status === "failed") return <XCircle className="size-4 text-destructive" />;
  return <CheckCircle2 className="size-4 text-success" />;
}

export function TurnCard({ turn }: { turn: Turn }) {
  return (
    <div className="mt-3 rounded-lg border bg-background p-3 text-sm">
      <ul className="space-y-1.5">
        {turn.steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2">
            <StepIcon status={step.status} />
            <span className={step.status === "running" ? "font-medium" : "text-muted-foreground"}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3">
        {turn.outcome ? <StatusBadge status={turn.outcome} /> : <StatusBadge status="running" />}
        {turn.preview_url && (
          <a
            href={turn.preview_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Preview <ExternalLink className="size-3" />
          </a>
        )}
        {turn.outcome && (
          <span className="ml-auto text-xs text-muted-foreground">${turn.cost_usd.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
