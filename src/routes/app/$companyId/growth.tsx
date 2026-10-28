import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";

import { StatusBadge, labelize } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getGrowth } from "@/lib/api";
import type { BindingConstraint, GrowthStepStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/$companyId/growth")({
  head: () => ({ meta: [{ title: "Growth — AppBuilder.ai" }] }),
  component: GrowthPage,
});

const CONSTRAINTS: { key: BindingConstraint; label: string; hint: string }[] = [
  { key: "found", label: "Find", hint: "Getting found by customers" },
  { key: "used", label: "Use", hint: "Getting them to use it" },
  { key: "paid", label: "Pay", hint: "Getting paid" },
];

function ConstraintIndicator({ current }: { current: BindingConstraint }) {
  const currentIndex = CONSTRAINTS.findIndex((c) => c.key === current);
  return (
    <ol className="grid grid-cols-3 gap-2">
      {CONSTRAINTS.map((c, i) => (
        <li
          key={c.key}
          aria-current={i === currentIndex ? "step" : undefined}
          className={cn(
            "rounded-lg border p-3",
            i === currentIndex
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {i < currentIndex ? (
              <Check className="size-4" />
            ) : (
              <span className="text-xs">{i + 1}</span>
            )}
            {c.label}
          </div>
          <p className="mt-1 hidden text-xs sm:block">{c.hint}</p>
        </li>
      ))}
    </ol>
  );
}

const FILTERS: ("all" | GrowthStepStatus)[] = ["all", "in_progress", "planned", "live", "dead"];

function GrowthPage() {
  const { companyId } = Route.useParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const growth = useQuery({ queryKey: ["growth", companyId], queryFn: () => getGrowth(companyId) });

  if (growth.isLoading || !growth.data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading growth ledger…</p>;
  }
  const { ledger, steps } = growth.data;
  const visible = filter === "all" ? steps : steps.filter((s) => s.status === filter);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Growth</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business read</CardTitle>
          <CardDescription>
            Updated {formatDistanceToNow(new Date(ledger.updated_at), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{ledger.business_read}</p>
          <div>
            <p className="mb-2 text-sm font-medium">Binding constraint</p>
            <ConstraintIndicator current={ledger.binding_constraint} />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Growth steps</h2>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                className="capitalize"
                onClick={() => setFilter(f)}
              >
                {labelize(f)}
              </Button>
            ))}
          </div>
        </div>
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps with this status.</p>
        )}
        {visible.map((step) => (
          <Card key={step.id}>
            <CardContent className="space-y-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <StatusBadge status={step.status} />
              </div>
              <p className="text-sm text-muted-foreground">{step.detail}</p>
              {step.evidence_url && (
                <a
                  href={step.evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Evidence <ExternalLink className="size-3" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
