import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "muted" | "info";

const toneClass: Record<Tone, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
  info: "border-primary/40 bg-accent text-accent-foreground",
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
  medium: "warning",
  // order stages (rejected is shared with drafts above)
  received: "muted",
  waiting_on_client: "warning",
  needs_staff: "danger",
  ready_to_confirm: "info",
  confirmed: "success",
  duplicate: "muted",
  // purchase orders
  po_open: "info",
  po_partly_received: "warning",
  po_fully_received: "success",
  po_closed: "muted",
  // invoice stages (received, duplicate, rejected shared above)
  waiting_on_supplier: "warning",
  needs_review: "danger",
  ready_to_approve: "info",
  approved_for_payment: "success",
  // three-way match
  full_match: "success",
  within_tolerance: "info",
  mismatch: "danger",
  no_po: "warning",
  ok: "success",
  matched: "success",
  price_off: "danger",
  qty_off: "danger",
  // supplier status
  on_hold: "warning",
  pending_onboarding: "warning",
  // payment
  current: "success",
  overdue: "danger",
  // roles
  admin: "info",
  ap_reviewer: "info",
  user: "muted",
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
