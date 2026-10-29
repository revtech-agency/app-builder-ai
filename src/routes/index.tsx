import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  ClipboardList,
  FlaskConical,
  Mail,
  Plug,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

import aiWorkersImage from "@/assets/ai-workers-paper-processes.jpg";
import heroImage from "@/assets/hero-robotic-document-workflow.jpg";
import { BackToTop } from "@/components/back-to-top";
import { ContactForm } from "@/components/contact-form";
import { ApDemoButton } from "@/components/demo-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Copy follows the NexxtAI finals deck (Raiffeisen, AI for Operational Efficiency): risky
// payments stopped before they leave, measured in euros held; the accounts-payable invoice
// worker leads, the company market and the quote & order worker follow as
// the same engine. Keep claims to what the deck and the repo show; the learning loop and the EU
// model route are not built or confirmed yet.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AppBuilder.ai — risky supplier payments stop before they leave" },
      {
        name: "description",
        content:
          "An AI worker for accounts payable: it checks every supplier invoice against its purchase order and delivery, holds duplicates, changed IBANs and overbilling before payment, and a person approves every payment.",
      },
      {
        property: "og:title",
        content: "AppBuilder.ai — risky supplier payments stop before they leave",
      },
      {
        property: "og:description",
        content:
          "0.8–2% of supplier payments go out duplicated or wrong. 12 checks hold them before payment, and a person approves every one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const TODAY = [
  "Invoices arrive by email as PDFs, each in the supplier's own format.",
  "A clerk matches every line against the PO and the delivery note.",
  "Fraud signals like a changed IBAN, a higher amount or a split purchase are easy to miss.",
];

const PROCESS_STATS = [
  {
    value: "0.8–2%",
    text: "of supplier payments go out duplicated or wrong (APQC benchmark): €0.8–2M for every €100M of supplier spend",
  },
  {
    value: "12",
    text: "checks on every invoice: duplicates, IBAN changes, unapproved suppliers, split purchases, price and quantity",
  },
  {
    value: "4",
    text: "outcomes: ready to approve, waiting on supplier, needs review, duplicate",
  },
  { value: "0", text: "payments approved by the AI: a person approves every one" },
];

const STEPS = [
  {
    name: "Intake",
    text: "An email to the AP inbox, a PDF or text in the app, or an RO e-Factura XML (simulated in the demo).",
  },
  { name: "Read", text: "Claude extracts every field with a confidence score." },
  { name: "Look up", text: "Supplier record, PO lines, quantities received, past invoices." },
  { name: "Decide", text: "12 coded rules; the worst result wins." },
  {
    name: "Act",
    text: "Sets the stage, logs every check, emails the result, drafts the supplier email.",
  },
];

type Owner = "Worker" | "Staff" | "Supplier";

const CHECKS: { situation: string; action: string; owner: Owner; protects: string }[] = [
  {
    situation: "Invoice number already received",
    action: "Marks it duplicate; never paid twice",
    owner: "Worker",
    protects: "Paying the same invoice twice",
  },
  {
    situation: "Sender isn't a known supplier",
    action: "Holds it for review",
    owner: "Staff",
    protects: "Paying a fake supplier",
  },
  {
    situation: "Supplier not approved yet",
    action: "Holds it and names the status",
    owner: "Staff",
    protects: "Paying an unvetted supplier",
  },
  {
    situation: "IBAN differs from the one on file",
    action: "Holds it: verify by phone",
    owner: "Staff",
    protects: "Money redirected to a fraudster's account",
  },
  {
    situation: "IBAN changed in the last 30 days",
    action: "Holds it: confirm the change",
    owner: "Staff",
    protects: "Money redirected after a spoofed change request",
  },
  {
    situation: "Tax certificate expired or missing",
    action: "Drafts an email asking for it",
    owner: "Supplier",
    protects: "Paying a non-compliant supplier",
  },
  {
    situation: "No PO number, or PO not found",
    action: "Drafts an email asking for it",
    owner: "Supplier",
    protects: "Paying without an approved order",
  },
  {
    situation: "A line that isn't on the PO",
    action: "Holds it and names the line",
    owner: "Staff",
    protects: "Paying for items never ordered",
  },
  {
    situation: "Price more than 2% off the PO",
    action: "Shows the difference per line",
    owner: "Staff",
    protects: "Overbilling",
  },
  {
    situation: "15 billed, 12 received",
    action: "Asks for a corrected quantity",
    owner: "Supplier",
    protects: "Paying for goods not received",
  },
  {
    situation: "Same PO, 14 days, each under €5,000",
    action: "Flags a possible split purchase",
    owner: "Staff",
    protects: "Getting around an approval limit",
  },
  {
    situation: "A field read with confidence under 0.80",
    action: "Sends it to a person to check",
    owner: "Staff",
    protects: "A misread amount or IBAN",
  },
];

const OWNER_TONE: Record<Owner, string> = {
  Worker: "border-border bg-muted text-muted-foreground",
  Staff: "border-destructive/25 bg-destructive/10 text-destructive",
  Supplier: "border-warning/30 bg-warning/10 text-warning",
};

const EVIDENCE = [
  {
    value: "12/12",
    text: "synthetic test cases right on four runs in a row, from a clean match to a split purchase",
  },
  {
    value: "3",
    text: "n8n flows: process invoices, a reviewer chat with read-only tools, a PO lookup",
  },
  {
    value: "1",
    text: "setup script that rebuilds the pipeline, suppliers, POs and invoice history on any HubSpot portal",
  },
];

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: "Safe by design",
    text: "The model never approves anything. Coded rules decide, and every check is written on the invoice record.",
  },
  {
    icon: Banknote,
    title: "Measured in euros held",
    text: "The app shows the money held before payment and why: duplicates, unverified payees, split purchases, overbilling per line.",
  },
  {
    icon: Plug,
    title: "Runs on the bank's approved tools",
    text: "The rules sit in one code step and every lookup and write is a connector. On the bank's ERP, workflow platform and EU model route, the 12 checks, the rules and the audit trail move unchanged.",
  },
  {
    icon: Receipt,
    title: "Paid per document",
    text: "€1.50 per invoice matched (draft price). For a bank: 20,000 invoices a year × €1.50 = €30k, against €0.8–2M at risk per €100M of spend (illustrative).",
  },
  {
    icon: Mail,
    title: "Results by email",
    text: "The reviewer gets every result by email: the money held and why, who approves, every check marked ✓ or ✗, and a link.",
  },
];

const NOT_PROVEN = [
  "Synthetic data only: 12 cases don't prove reliability on real invoices.",
  "HubSpot stands in for the bank's ERP.",
  "Scanned, image-only PDFs can't be read yet.",
  "The demo model runs through the Anthropic API (US). Production is planned in the EU; the EU model route is still to be confirmed.",
  "The learning loop, where corrections staff confirm become history for the next invoice, isn't built yet.",
];

const MARKET_STATS = [
  { value: "5%", text: "of Romanian enterprises use AI (EU: 20%), Eurostat 2025" },
  {
    value: "12 min",
    text: "to retype one order by hand (vendor studies: 8–25 min): about €1.37 of labour at €6.85 an hour",
  },
];

const WORKERS = [
  {
    icon: ShoppingCart,
    side: "Buying side",
    name: "Purchasing worker",
    text: "Supplier invoice → matched three ways to the purchase order and the delivery note → ready for approval. The worker in the demo.",
  },
  {
    icon: ClipboardList,
    side: "Selling side",
    name: "Quote & order worker",
    text: "The same engine adapted to selling: customer order by email, live chat or WhatsApp → quote → confirmed order. Maps each client's codes to your items and converts quantities into packs.",
  },
];

// Anonymized until each company agrees to be named.
const PROOF = [
  {
    status: "Proof-of-concept client",
    company: "A meat-accessories supplier",
    worker: "Quote & order worker",
    text: "216 clients order in their own formats and codes, for 250 items sold in metres and shipped in whole packs. Four people retype and confirm those orders today. The worker turns “4,200 m, calibre 52” into a quote for 9 rolls of 500 m.",
  },
  {
    status: "Pilot prospect",
    company: "A security services company",
    worker: "Purchasing worker",
    text: "About 60 staff, and about 430 purchase orders a year still written by hand in Word documents.",
  },
];

// Secondary entry for people who already have an account; the demo is the main path.
function OpenAppLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/app"
      className={cn(
        "inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline",
        className,
      )}
    >
      Open the app <ArrowRight className="size-3.5" />
    </Link>
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
          <div className="flex items-center gap-4">
            <OpenAppLink className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline-flex" />
            <ApDemoButton>Try the demo</ApDemoButton>
          </div>
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
                NexxtAI Hackathon 2026 · AI for Operational Efficiency
              </p>
              <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
                Risky supplier payments stop before they leave.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                An AI worker for a bank's accounts-payable team. It checks every supplier invoice
                against its purchase order and delivery, runs 12 checks, from a duplicate to a
                changed IBAN, and holds the risky ones. A person approves every payment; the AI
                approves none.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ApDemoButton size="lg">Try the demo</ApDemoButton>
                <Button asChild size="lg" variant="outline">
                  <a href="#contact">Talk to us</a>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Everything in the demo is synthetic: suppliers, purchase orders and invoices. Have
                an account? <OpenAppLink className="text-foreground" />
              </p>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Every supplier invoice is checked by hand before it is paid
            </h2>
            <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-muted-foreground">
              {TODAY.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-6 flex flex-wrap items-center gap-2 font-mono text-sm">
              {["Purchase order", "=", "Delivery note", "=", "Invoice", "→", "Approve or flag"].map(
                (t, i) =>
                  t.length === 1 ? (
                    <span key={i} className="text-muted-foreground">
                      {t}
                    </span>
                  ) : (
                    <span key={i} className="rounded-md border bg-card px-2.5 py-1">
                      {t}
                    </span>
                  ),
              )}
            </p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STATS.map((s) => (
                <div key={s.value}>
                  <dt className="text-5xl font-semibold tracking-tight md:text-6xl">{s.value}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{s.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-foreground" />
              <span>
                The same flow (read, look up, apply the rules, flag, a person decides) adapts to
                other rule-based document processes, such as quote to order, validating applications
                or reconciling records. Only the lookups and the rules change.
              </span>
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            The LLM reads; coded, deterministic rules decide anything about money
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
          <p className="mt-6 text-muted-foreground">
            <span className="font-semibold text-foreground">A person decides:</span> approve, send
            back, mark as duplicate or reject, with every failed check in view.
          </p>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              12 checks, each with an owner
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              The worst result wins. Supplier questions, payment reminders and other documents also
              go to a person. The 2% tolerance and the €5,000 limit are demo settings.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHECKS.map((c) => (
                <li key={c.situation} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold">{c.situation}</h3>
                    <span
                      className={cn(
                        "shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
                        OWNER_TONE[c.owner],
                      )}
                    >
                      {c.owner}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.action}</p>
                  <p className="mt-2 text-xs">
                    <span className="text-muted-foreground">Protects against:</span> {c.protects}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            You can check all of it
          </h2>
          <dl className="mt-8 grid gap-6 sm:grid-cols-3">
            {EVIDENCE.map((s) => (
              <div key={s.value}>
                <dt className="text-5xl font-semibold tracking-tight md:text-6xl">{s.value}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{s.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">
            Demo stack: n8n · Claude Sonnet 5.5 · HubSpot · Lovable, stand-ins for the bank's ERP,
            workflow platform and review screen. Built to be rebuilt on the bank's approved tools.
            Code, workflows, test cases and the setup script:{" "}
            <a
              href="https://github.com/revtech-agency/app-builder-ai"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              github.com/revtech-agency/app-builder-ai
            </a>
          </p>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <p.icon className="size-6 text-foreground" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-xl border p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-5" />
              What we haven't proven yet
            </h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {NOT_PROVEN.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Next:</span> a pilot with one bank accounts-payable
              team on real supplier invoices, measured in euros of risky payments held. Then RO
              e-Factura intake (simulated in the demo today; it covers Romanian suppliers, so email
              stays for foreign ones) and other CEE markets: the checks are country-neutral.
            </p>
          </div>
        </section>

        <section className="border-y bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              One engine, adapted to each document process
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              The invoice worker's steps carry over to other processes: read the document, look up
              the records, apply that process's rules, flag the exceptions, a person decides.
              Adapting it means new lookups and new rules, not a new product, so each next worker
              goes live faster. Companies with 10–249 staff still run purchasing and orders by phone
              and email, which makes them the next market.
            </p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              {MARKET_STATS.map((s) => (
                <div key={s.value}>
                  <dt className="text-5xl font-semibold tracking-tight md:text-6xl">{s.value}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{s.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {WORKERS.map((w) => (
                <div key={w.name} className="flex gap-4 rounded-xl border bg-card p-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <w.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {w.side}
                    </p>
                    <h3 className="font-semibold">{w.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{w.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 shrink-0 text-foreground" />
              Priced per piece of work done, not per seat. Partners set it up; no IT team needed.
            </p>

            <h3 className="mt-12 text-xl font-semibold tracking-tight">
              Built on real company flows
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PROOF.map((p) => (
                <figure key={p.company} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {p.status} · {p.worker}
                  </p>
                  <h4 className="mt-1 font-semibold">{p.company}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 pb-20">
          <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground md:px-12">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              See a risky payment held
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
              Try the demo: the overview shows the euros held before payment, and every invoice says
              why. Or tell us which flow eats your team's week.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <ApDemoButton size="lg" variant="secondary">
                Try the demo
              </ApDemoButton>
              <OpenAppLink className="text-sm text-primary-foreground/80 hover:text-primary-foreground" />
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
              Tell us who you are. After you send it, we'll email you to set up a short call about
              running your invoice checks, purchasing or quote &amp; order flow on an AI worker.
            </p>
            <img
              src={aiWorkersImage}
              alt="AI workers read, understand and act on paper business documents, from supplier invoices to customer orders."
              width={900}
              height={900}
              loading="lazy"
              className="mt-6 w-full max-w-md rounded-lg border"
            />
          </div>
          <div className="rounded-xl border bg-card p-6">
            <ContactForm />
            <p className="mt-4 text-xs text-muted-foreground">
              We use your details only to reply to you. We keep them in our CRM and never sell or
              share them.
            </p>
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
