import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "muted" | "info";

const toneClass: Record<Tone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
  info: "border-primary/25 bg-primary/10 text-primary",
};

const statusTone: Record<string, Tone> = {
  // companies
  active: "success",
  provisioning: "warning",
  paused: "muted",
  // turns
  running: "warning",
  shipped: "success",
  failed: "danger",
  no_change: "muted",
  asked_founder: "info",
  // growth steps
  planned: "info",
  in_progress: "warning",
  live: "success",
  dead: "muted",
  // deployments
  queued: "muted",
  building: "warning",
  superseded: "muted",
  // drafts
  draft: "warning",
  approved: "success",
  sent: "success",
  rejected: "danger",
  // domains
  pending_payment: "warning",
  registering: "warning",
  verifying: "warning",
  // purchases
  awaiting_payment: "warning",
  paid: "success",
  cancelled: "muted",
  blocked: "danger",
  // asks
  open: "warning",
  answered: "success",
  expired: "muted",
  // priority
  high: "danger",
  normal: "info",
  low: "muted",
};

// eslint-disable-next-line react-refresh/only-export-components
export const labelize = (value: string) => value.replace(/_/g, " ");

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize", toneClass[statusTone[status] ?? "muted"], className)}
    >
      {labelize(status)}
    </Badge>
  );
}
