import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileText,
  Plug,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserCheck,
} from "lucide-react";

import { ContactForm } from "@/components/contact-form";
import { DemoButton } from "@/components/demo-button";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AppBuilder.ai — AI workers for SME back-office work" },
      {
        name: "description",
        content:
          "AI workers that enter orders, send quotes and place purchases for SMEs, priced per piece of work, with a person approving every sensitive step.",
      },
      { property: "og:title", content: "AppBuilder.ai — AI workers for SME back-office work" },
      {
        property: "og:description",
        content: "Orders entered, quotes sent, purchases placed. Priced per piece of work done.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PROBLEMS = [
  {
    title: "Orders retyped",
    text: "Orders arrive by email, WhatsApp, PDF and phone, and someone keys each one into the ERP or a spreadsheet.",
  },
  {
    title: "Quotes take days",
    text: "The owner prices every request by hand from drawings, emails and old spreadsheets, and slow quotes cost jobs.",
  },
  {
    title: "Purchasing by phone",
    text: "Supplier offers are compared in spreadsheets, and late deliveries are chased one call at a time.",
  },
  {
    title: "No IT, real risk",
    text: "Nobody inside can set up AI safely, so staff paste client data into personal AI accounts.",
  },
];

// cta "demo" opens the live demo (only the order worker runs there today);
// "contact" scrolls to the form.
const WORKERS = [
  {
    icon: ClipboardList,
    name: "Order worker",
    text: "Reads orders from email, WhatsApp and PDF, maps each client's codes to your items, then enters and confirms them.",
    cta: { kind: "demo", label: "Try it in the demo" },
  },
  {
    icon: FileText,
    name: "Quote worker",
    text: "Prices each request from your rules and past jobs, sends the offer and follows up.",
    cta: { kind: "contact", label: "Talk to us about quotes" },
  },
  {
    icon: ShoppingCart,
    name: "Purchasing worker",
    text: "Compares supplier offers, raises the PO after approval and chases late deliveries.",
    cta: { kind: "contact", label: "Talk to us about purchasing" },
  },
  {
    icon: Sparkles,
    name: "The next worker",
    text: "Invoice matching, delivery scheduling, payment reminders: any repeatable flow, built on the same modules.",
    cta: { kind: "contact", label: "Tell us your flow" },
  },
] as const;

const STEPS = [
  { name: "Read", text: "Sorts each message: order, change or request." },
  { name: "Extract", text: "Pulls out items, quantities and dates, with a confidence score." },
  { name: "Check", text: "Matches codes, item lists, pack sizes and minimums." },
  { name: "Decide", text: "Clean: one-click confirm. Fixable: asks the client. Risky: to staff." },
  { name: "Act", text: "Updates the CRM or ERP and replies to the client." },
];

const PRINCIPLES = [
  {
    icon: Receipt,
    title: "Priced on work done",
    text: "You pay per order, quote or PO handled, not per seat.",
  },
  {
    icon: UserCheck,
    title: "People approve what matters",
    text: "Every sensitive step waits for a person, with the reason shown.",
  },
  {
    icon: ShieldCheck,
    title: "Hosted in the EU",
    text: "Your data stays in the EU, with permissions and an audit trail on every action.",
  },
  {
    icon: Plug,
    title: "Works with what you use",
    text: "Email, WhatsApp, your CRM and ERP. No IT team needed: partners set it up.",
  },
];

function TalkToUsLink({ className, children = "Talk to us" }: { className?: string; children?: React.ReactNode }) {
  return (
    <a href="#contact" className={className}>
      {children}
    </a>
  );
}

function Index() {
  return (
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              A
            </span>
            AppBuilder.ai
          </span>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#workers" className="hover:text-foreground">Workers</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app">Sign in</Link>
            </Button>
            <DemoButton size="sm" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 md:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <BadgeCheck className="size-3.5 text-primary" />
            AI workers for SME back-office work
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Orders entered, quotes sent, purchases placed.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            AppBuilder.ai runs the repeatable work your team retypes, chases and compares every day.
            Each worker handles the clean cases on its own and flags only the exceptions, with a
            person approving every sensitive step.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DemoButton size="lg" />
            <Button asChild size="lg" variant="outline">
              <a href="#contact">Talk to us</a>
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No sign-up: the demo opens a shared account with sample orders.
          </p>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              SMEs pay people to retype, chase and compare
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-xl border bg-card p-5">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workers" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            We sell the worker, not the tool
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start with one flow. Every worker runs on the same modules, so the next one goes live
            faster.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {WORKERS.map((w) => (
              <div key={w.name} className="flex gap-4 rounded-xl border p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <w.icon className="size-5" />
                </span>
                <div className="flex flex-col">
                  <h3 className="font-semibold">{w.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{w.text}</p>
                  <div className="mt-3">
                    {w.cta.kind === "demo" ? (
                      <DemoButton variant="link" className="h-auto px-0">
                        {w.cta.label}
                      </DemoButton>
                    ) : (
                      <TalkToUsLink className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        {w.cta.label} <ArrowRight className="size-4" />
                      </TalkToUsLink>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <DemoButton size="lg" />
            <span className="text-sm text-muted-foreground">
              See the order worker handle real messages.
            </span>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Five steps, people only for decisions
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.name} className="rounded-xl border bg-card p-5">
                  <span className="text-sm font-semibold text-primary">{i + 1}</span>
                  <h3 className="mt-1 font-semibold">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <p.icon className="size-6 text-primary" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 pb-20">
          <div className="grid gap-10 rounded-2xl bg-primary px-6 py-12 text-primary-foreground md:grid-cols-2 md:px-12">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                See a worker handle real orders
              </h2>
              <p className="mt-3 max-w-md text-primary-foreground/80">
                Open the demo in one click, or tell us which flow eats your team's week and we'll
                show you that one.
              </p>
              <div className="mt-6">
                <DemoButton size="lg" variant="secondary" />
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span>© 2026 AppBuilder.ai</span>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-foreground">
              Privacy
            </a>
            <a href="mailto:daniel@appbuilder.ai" className="hover:text-foreground">
              daniel@appbuilder.ai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
