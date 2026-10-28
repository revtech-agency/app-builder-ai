// Calls the n8n "AI Sales Proposal" workflow (POST /webhook/sales-analysis) from the server,
// so the webhook URL stays out of the browser and only signed-in founders can trigger it.
// Each run creates a Google Slides deck and a HubSpot contact, deal and task.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_WEBHOOK_URL = "https://revtech-agency.app.n8n.cloud/webhook/sales-analysis";

const SalesRequest = z.object({
  request: z.string().trim().min(10, "Describe the customer request in a sentence or two."),
  contact: z.object({
    first_name: z.string().trim(),
    last_name: z.string().trim(),
    email: z.string().trim(),
    company: z.string().trim(),
    phone: z.string().trim(),
  }),
});

export type SalesRequest = z.infer<typeof SalesRequest>;

// Mirrors the workflow's "Return Analysis" response.
export type SalesAnalysis = {
  success: boolean;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    company: string;
    job_title?: string;
    industry?: string;
    company_size?: string;
  };
  requirements: {
    summary: string;
    key_needs: string[];
    pain_points?: string[];
    timeline?: string;
    budget_range?: string;
  };
  pricing: {
    currency: string;
    line_items: { item: string; description?: string; price: number }[];
    total_estimate: number;
    pricing_notes?: string;
  };
  proposal: {
    title: string;
    executive_summary: string;
    proposed_solution: string;
    deliverables: string[];
    next_steps: string[];
  };
  lead_score: number;
  priority: "high" | "medium" | "low";
  slides: { presentationId: string; url: string };
  hubspot: { contactId: number | string; dealId: number | string; taskId: number | string | null };
};

export const runSalesAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SalesRequest) => SalesRequest.parse(input))
  .handler(async ({ data }): Promise<SalesAnalysis> => {
    const url = process.env["N8N_SALES_ANALYSIS_URL"] || DEFAULT_WEBHOOK_URL;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Sales analysis failed (${res.status}): ${text.slice(0, 300) || res.statusText}`,
      );
    }
    try {
      return JSON.parse(text) as SalesAnalysis;
    } catch {
      throw new Error("Sales analysis returned an unreadable response.");
    }
  });
