import { FileInput, FileText, Landmark, Mail, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { anomalyLabel, APPROVAL_LABELS, DANGER_ANOMALIES } from "@/lib/invoice-rules";
import { riskLabel } from "@/lib/money";
import type { Risk } from "@/lib/money";
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

// Where an invoice came from (the deal's order_channel), for the queue's Source column.
// eslint-disable-next-line react-refresh/only-export-components
export const SOURCES: Record<string, { label: string; icon: typeof Mail }> = {
  efactura: { label: "e-Factura", icon: Landmark },
  email: { label: "Email", icon: Mail },
  app: { label: "Manual", icon: FileInput },
  pdf: { label: "PDF", icon: FileText },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
};

export function SourceLabel({ channel }: { channel: string | null }) {
  const s = channel ? SOURCES[channel] : undefined;
  if (!s) return <span className="text-muted-foreground">{channel ?? "—"}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <s.icon className="size-3.5 text-muted-foreground" />
      {s.label}
    </span>
  );
}

// The euros an invoice put at risk, for tables: amount plus the reason in small print.
export function RiskCell({ risk }: { risk: Risk }) {
  if (!risk.category) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="whitespace-nowrap">
      <p className="font-medium tabular-nums">{formatMoney(risk.amount)}</p>
      <p className="text-xs text-muted-foreground">{riskLabel(risk.category)}</p>
    </div>
  );
}
