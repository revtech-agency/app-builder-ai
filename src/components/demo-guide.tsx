import { Link, useLocation } from "@tanstack/react-router";
import { Check, Compass, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEMO_STEPS,
  nextDemoStep,
  restartDemoGuide,
  setDemoGuideHidden,
  useDemoGuide,
} from "@/lib/demo-guide";
import { cn } from "@/lib/utils";

// Step-by-step guide shown above the invoice desk pages to the demo account only.
export function DemoGuide() {
  const { done, hidden } = useDemoGuide();
  const { pathname } = useLocation();
  const next = nextDemoStep(done);

  if (hidden) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
        <Button variant="outline" size="sm" onClick={() => setDemoGuideHidden(false)}>
          <Compass /> Show the demo guide
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
      <section
        aria-label="Demo guide"
        className="rounded-lg border border-primary/40 bg-accent/40 p-4 text-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Compass className="size-4" /> Demo guide
            </p>
            <p className="text-muted-foreground">
              Five steps, about three minutes. Follow the highlighted step.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hide the demo guide"
            onClick={() => setDemoGuideHidden(true)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {DEMO_STEPS.map((s, i) => {
            const isDone = done.includes(s.key);
            const isNext = next?.key === s.key;
            return (
              <li
                key={s.key}
                aria-current={isNext ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
                  isNext && "border-primary font-medium ring-1 ring-primary",
                  isDone && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
                    isDone && "border-success bg-success/15 text-success",
                    isNext && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {isDone ? <Check className="size-3" /> : i + 1}
                </span>
                <span className="leading-tight">{s.title}</span>
              </li>
            );
          })}
        </ol>

        {next ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-medium">Next: {next.title}. </span>
              {next.hint}
            </p>
            {pathname !== next.to && (
              <Button asChild size="sm">
                <Link to={next.to}>{next.cta}</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-medium">Demo complete. </span>
              You've seen the worker read, check and file an invoice, and kept the decision
              yourself.
            </p>
            <Button size="sm" variant="outline" onClick={restartDemoGuide}>
              <RotateCcw /> Start again
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
