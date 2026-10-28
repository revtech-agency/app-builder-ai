import { Badge } from "@/components/ui/badge";
import { anomalyLabel, APPROVAL_LABELS, DANGER_ANOMALIES } from "@/lib/invoice-rules";
import { cn } from "@/lib/utils";

export function AnomalyChips({ flags, className }: { flags: string[]; className?: string }) {
  if (flags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {flags.map((f) => (
        <Badge
          key={f}
          variant="outline"
          className={cn(
            "font-normal",
            DANGER_ANOMALIES.has(f)
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "border-warning/30 bg-warning/10 text-warning",
          )}
        >
          {anomalyLabel(f)}
        </Badge>
      ))}
    </div>
  );
}

export const approvalText = (level: string | null) =>
  level ? `Needs ${APPROVAL_LABELS[level] ?? level.replace(/_/g, " ")} approval` : "—";

export const approvalShort = (level: string | null) =>
  level ? (APPROVAL_LABELS[level] ?? level.replace(/_/g, " ")) : "—";
