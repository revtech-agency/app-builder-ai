import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  Receipt,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import aiWorkersImage from "@/assets/ai-workers-paper-processes.jpg";
import heroImage from "@/assets/hero-robotic-document-workflow.jpg";
import { BackToTop } from "@/components/back-to-top";
import { ContactForm } from "@/components/contact-form";
import { DemoButton } from "@/components/demo-button";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AppBuilder.ai — Supplier invoice worker for accounts payable" },
      {
        name: "description",
        content:
          "Supplier invoices checked against the purchase order and delivery note. Clean ones go to one-click approval, risky ones are held with the reason.",
      },
      {
        property: "og:title",
        content: "AppBuilder.ai — Supplier invoice worker for accounts payable",
      },
      {
        property: "og:description",
        content:
          "Three-way match on every invoice. Clean invoices go to one-click approval, risky ones are held with the reason, and people approve what matters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const STATS = [
  { value: "9", text: "rules checked on every supplier invoice" },
  {
    value: "6 min",
    text: "assumed hand-processing time per clean invoice, used for the time-saved figure",
  },
];

const PROBLEMS = [
  {
    title: "Invoices retyped and matched by hand",
    text: "Invoices arrive by email and PDF. Someone keys each one in and checks it line by line against the purchase order and the delivery note.",
  },
  {
    title: "Duplicate and fraud risk",
    text: "The same invoice paid twice, or a supplier whose bank details quietly changed, are easy to miss in a queue.",
  },
  {
    title: "Slow approvals",
    text: "Clean invoices wait in the same queue as risky ones, so approvers cannot see what needs real attention.",
  },
];

const RULES = [
  "Duplicate invoice",
  "IBAN differs, or changed in the last 30 days",
  "Unknown or unapproved supplier",
  "Split purchases just under an approval limit",
  "Price more than 2% off the PO",
  "Quantity above what was delivered",
  "Missing PO",
  "Expired tax certificate",
  "Low extraction confidence",
];

const OUTCOMES = [
  { name: "Ready to approve", text: "Every check passed. One click from the right approver." },
  {
    name: "Waiting on supplier",
    text: "Something is missing; the worker drafts the question to the supplier.",
  },
  { name: "Needs review", text: "A rule fired. Held with the reason and the numbers behind it." },
  { name: "Duplicate", text: "Already processed. Stopped before it can be paid twice." },
];

const STEPS = [
  { name: "Read", text: "Takes each invoice from email or upload." },
  { name: "Extract", text: "Pulls supplier, IBAN, amounts and lines, with a confidence score." },
  { name: "Check", text: "Against the PO, the delivery note and the supplier record." },
  { name: "Decide", text: "Clear: one click. Fixable: asks the supplier. Risky: to a person." },
  { name: "Act", text: "Moves the invoice to its stage and writes an audit note." },
];

const PRINCIPLES = [
  {
    icon: UserCheck,
    title: "People approve what matters",
    text: "Nothing is approved for payment without a person, with the reason shown.",
  },
  {
    icon: ShieldCheck,
    title: "Every decision shows its working",
    text: "Each hold shows the rule and the numbers behind it.",
  },
  {
    icon: Receipt,
    title: "Approval limits by role",
    text: "Team lead, head of department or CFO, depending on the amount.",
  },
  {
    icon: ClipboardList,
    title: "An audit note on every invoice",
    text: "Each check is recorded as a tick or a cross on the invoice.",
  },
];

function OpenAppButton({ size = "default" }: { size?: "default" | "lg" }) {
  return (
    <Button asChild size={size}>
      <Link to="/app">
        Open the app <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              A
            </span>
            AppBuilder.ai
          </span>
          <OpenAppButton />
        </div>
      </header>

      <main>
        <section
          className="bg-cover bg-right-bottom bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          {/* Fade from the left keeps the headline readable over the image. */}
          <div className="bg-gradient-to-r from-background via-background/90 to-background/75 md:via-background/85 md:to-background/20">
            <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 md:pt-24">
              <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <BadgeCheck className="size-3.5 text-foreground" />
                AI for accounts payable
              </p>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
                Supplier invoices checked against the PO and delivery note, automatically.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                Every invoice gets a three-way match. Clean ones go to one-click approval, risky
                ones are held with the reason, and people approve what matters.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <OpenAppButton size="lg" />
                <DemoButton size="lg" variant="outline" />
                <Button asChild size="lg" variant="ghost">
                  <a href="#contact">Talk to us</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Accounts payable still runs on retyping and manual matching
            </h2>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              {STATS.map((s) => (
                <div key={s.value}>
                  <dt className="text-5xl font-semibold tracking-tight md:text-6xl">{s.value}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{s.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMS.map((p) => (
                <div key={p.title} className="rounded-xl border bg-card p-5">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">What it checks</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Fixed rules, applied the same way to every invoice. A rule that fires is shown on the
            invoice with the numbers behind it.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map((r) => (
              <li key={r} className="flex items-start gap-3 rounded-xl border p-4 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Five steps, people only for decisions
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.name} className="rounded-xl border bg-card p-5">
                  <span className="inline-flex size-6 items-center justify-center rounded-sm bg-primary font-mono text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-1 font-semibold">{s.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-muted-foreground">Each invoice ends in one of four outcomes.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {OUTCOMES.map((o) => (
                <div key={o.name} className="rounded-xl border bg-card p-5">
                  <h3 className="font-semibold">{o.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{o.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <p.icon className="size-6 text-foreground" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground md:px-12">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              See the invoice worker at work
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Sign in to the app to try it. The demo uses synthetic data, and a CRM stands in for
              the bank's ERP.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to="/app">
                  Open the app <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div
          id="contact"
          className="mx-auto grid w-full max-w-6xl scroll-mt-20 gap-8 px-4 py-12 md:grid-cols-2"
        >
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Contact us</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Tell us who you are and we'll get back to you about running supplier invoices through
              an AI worker.
            </p>
            <img
              src={aiWorkersImage}
              alt="AI workers read, understand and act on paper business documents without manual work."
              width={900}
              height={900}
              loading="lazy"
              className="mt-6 w-full max-w-md rounded-lg border"
            />
          </div>
          <div className="rounded-xl border bg-card p-6">
            <ContactForm />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t px-4 py-6 text-sm text-muted-foreground">
          <span>© 2026 AppBuilder.ai</span>
          <a href="mailto:daniel@appbuilder.ai" className="hover:text-foreground">
            daniel@appbuilder.ai
          </a>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}
