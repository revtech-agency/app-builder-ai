// Guided path for the invoice desk demo account: five steps a first-time visitor follows.
// Progress lives in this browser only (localStorage); losing it just restarts the guide.
import { useEffect, useState } from "react";

export const DEMO_STEPS = [
  {
    key: "submitted",
    title: "Submit a sample invoice",
    hint: "A sample invoice is already loaded: press Submit, or pick one of the other two samples first. The AI worker reads it, matches it to the purchase order and delivery note, and files it in a few seconds.",
    to: "/app/invoices/new",
    cta: "Go to Submit document",
  },
  {
    key: "opened",
    title: "Open the invoice",
    hint: "Press Open invoice on the result (or open it from the Queue) to see why the worker put it in that stage: the checks, the three-way match and the supplier details.",
    to: "/app/invoices",
    cta: "Go to the Queue",
  },
  {
    key: "asked",
    title: "Ask the worker",
    hint: "On the invoice, press Ask the worker and try a suggested question. It explains its decision with the numbers, but never changes anything.",
    to: "/app/invoices",
    cta: "Pick an invoice in the Queue",
  },
  {
    key: "decided",
    title: "Make the decision",
    hint: "You decide, not the worker: approve an invoice that is Ready to approve, or send back or reject one that needs review.",
    to: "/app/invoices",
    cta: "Go to the Queue",
  },
  {
    key: "reset",
    title: "Reset the demo",
    hint: "On the Queue, press Reset demo. It removes your test invoices and restores the sample data for the next visitor.",
    to: "/app/invoices",
    cta: "Go to the Queue",
  },
] as const;

export type DemoStepKey = (typeof DEMO_STEPS)[number]["key"];

const KEYS = DEMO_STEPS.map((s) => s.key) as string[];
const STORAGE = "appbuilder-demo-guide";
const CHANGE = "appbuilder-demo-guide-change";

// The first step not done yet, or null when the visitor has finished.
export function nextDemoStep(done: readonly string[]) {
  return DEMO_STEPS.find((s) => !done.includes(s.key)) ?? null;
}

type Stored = { done: DemoStepKey[]; hidden: boolean };

function read(): Stored {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as Partial<Stored>;
    return {
      done: Array.isArray(v.done) ? v.done.filter((k): k is DemoStepKey => KEYS.includes(k)) : [],
      hidden: v.hidden === true,
    };
  } catch {
    return { done: [], hidden: false };
  }
}

function write(next: Stored) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(next));
  } catch {
    // Storage blocked (private window): the guide just won't remember progress.
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function markDemoStep(step: DemoStepKey) {
  if (typeof window === "undefined") return;
  const s = read();
  if (!s.done.includes(step)) write({ ...s, done: [...s.done, step] });
}

export function restartDemoGuide() {
  write({ done: [], hidden: false });
}

export function setDemoGuideHidden(hidden: boolean) {
  write({ ...read(), hidden });
}

export function useDemoGuide(): Stored {
  const [state, setState] = useState<Stored>({ done: [], hidden: false });
  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}
