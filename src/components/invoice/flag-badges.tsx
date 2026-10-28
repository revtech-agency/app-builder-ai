import { TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FLAG_LABELS } from "@/lib/invoice-types";
import type { AnomalyFlag } from "@/lib/invoice-types";

export function FlagBadges({ flags }: { flags: AnomalyFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <Badge
          key={f}
          variant="outline"
          className="border-warning/30 bg-warning/10 text-xs font-medium text-warning"
        >
          <TriangleAlert className="size-3" aria-hidden />
          {FLAG_LABELS[f] ?? f}
        </Badge>
      ))}
    </div>
  );
}
