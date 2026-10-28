import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { runSalesAnalysis } from "@/lib/sales-analysis";
import type { SalesAnalysis, SalesRequest } from "@/lib/sales-analysis";

export const Route = createFileRoute("/app/$companyId/sales-analysis")({
  head: () => ({ meta: [{ title: "Sales analysis — AppBuilder.ai" }] }),
  component: SalesAnalysisPage,
});

const EMPTY: SalesRequest = {
  request: "",
  contact: { first_name: "", last_name: "", email: "", company: "", phone: "" },
};

const CONTACT_FIELDS: { key: keyof SalesRequest["contact"]; label: string; type?: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone", type: "tel" },
];

function SalesAnalysisPage() {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState<SalesRequest>(EMPTY);
  const analysis = useMutation({ mutationFn: (data: SalesRequest) => runSalesAnalysis({ data }) });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a customer request. The AI drafts requirements, pricing and a proposal, builds a
          Slides deck, and logs the contact, deal and follow-up task in HubSpot.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              analysis.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="request">Customer request</Label>
              <Textarea
                id="request"
                rows={6}
                required
                placeholder="E.g. the email or call notes describing what the customer needs, budget and timeline."
                value={form.request}
                onChange={(e) => setForm({ ...form, request: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {CONTACT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>
                    {f.label} <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={f.key}
                    type={f.type ?? "text"}
                    value={form.contact[f.key]}
                    onChange={(e) =>
                      setForm({ ...form, contact: { ...form.contact, [f.key]: e.target.value } })
                    }
                  />
                </div>
              ))}
            </div>
            {analysis.isError && (
              <p className="text-sm text-destructive">{analysis.error.message}</p>
            )}
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                Running an analysis creates real HubSpot records, so it's limited to admins.
              </p>
            )}
            <Button type="submit" disabled={!isAdmin || analysis.isPending}>
              {analysis.isPending && <Loader2 className="size-4 animate-spin" />}
              {analysis.isPending ? "Analysing (up to a minute)…" : "Run analysis"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {analysis.data && <AnalysisResult result={analysis.data} />}
    </div>
  );
}

function List({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function AnalysisResult({ result }: { result: SalesAnalysis }) {
  const { customer: c, requirements: r, pricing: p, proposal: pr } = result;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency || "USD" }).format(n);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{pr.title}</CardTitle>
            <StatusBadge status={result.priority} />
            <span className="text-sm text-muted-foreground">
              Lead score {result.lead_score}/100
            </span>
          </div>
          <CardDescription>
            {[c.first_name, c.last_name].filter(Boolean).join(" ")}
            {c.company ? ` · ${c.company}` : ""}
            {c.email ? ` · ${c.email}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{pr.executive_summary}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={result.slides.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Open proposal deck <ExternalLink className="size-3.5" />
            </a>
            <span className="text-muted-foreground">
              HubSpot deal {String(result.hubspot.dealId)} · contact{" "}
              {String(result.hubspot.contactId)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{r.summary}</p>
            <List items={r.key_needs} />
            {r.pain_points?.length ? (
              <>
                <p className="text-sm font-medium">Pain points</p>
                <List items={r.pain_points} />
              </>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {r.timeline && `Timeline: ${r.timeline}`}
              {r.timeline && r.budget_range && " · "}
              {r.budget_range && `Budget: ${r.budget_range}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y text-sm">
              {p.line_items.map((li) => (
                <li key={li.item} className="flex justify-between gap-4 py-2">
                  <span>
                    {li.item}
                    {li.description && (
                      <span className="block text-xs text-muted-foreground">{li.description}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium">{money(li.price)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>{money(p.total_estimate)}</span>
            </p>
            {p.pricing_notes && <p className="text-xs text-muted-foreground">{p.pricing_notes}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposed solution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{pr.proposed_solution}</p>
          <p className="text-sm font-medium">Deliverables</p>
          <List items={pr.deliverables} />
          <p className="text-sm font-medium">Next steps</p>
          <List items={pr.next_steps} />
        </CardContent>
      </Card>
    </div>
  );
}
