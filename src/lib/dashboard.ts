// Admin revenue dashboard backed by HubSpot (portal 149650024): client companies, invoice_worker
// clients, their AppBuilder plan properties and the supplier documents they bill for. Read-only.
import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/admin";
import { computeClientBilling, computeTotals, CURRENCY, dashboardMonths } from "@/lib/billing";
import type { DashboardTotals, MonthBilling } from "@/lib/billing";

export type DashboardClient = {
  id: string;
  name: string;
  plan: string | null;
  monthlyFee: number | null;
  feePerOrder: number | null;
  start: string | null;
  paymentStatus: string;
  ordersThisMonth: number;
  revenueThisMonth: number;
  revenueToDate: number;
  orderValueToDate: number;
  monthly: MonthBilling[];
};

export type PlatformDashboard = {
  currency: typeof CURRENCY;
  months: string[];
  totals: DashboardTotals;
  clients: DashboardClient[];
};

type Props = Record<string, string | null | undefined>;
type HsObject = { id: string; properties: Props };

const PLAN_LABELS: Record<string, string> = { invoice_worker: "Invoice worker" };

// Supplier invoice worker: documents live in the "default" deal pipeline.
const INVOICE_PIPELINE_ID = "default";
// Duplicate and Rejected documents are not billable.
const INVOICE_NON_BILLABLE_STAGES = ["6318170303", "6318170304"] as const;

const num = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

export const getPlatformDashboard = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<PlatformDashboard> => {
    const { hubspot } = await import("@/lib/hubspot.server");

    const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
      body: {
        filterGroups: [
          {
            filters: [{ propertyName: "appbuilder_plan", operator: "EQ", value: "invoice_worker" }],
          },
        ],
        properties: [
          "name",
          "appbuilder_plan",
          "appbuilder_monthly_fee",
          "appbuilder_fee_per_order",
          "appbuilder_subscription_start",
        ],
        sorts: [{ propertyName: "name", direction: "ASCENDING" }],
        limit: 100,
      },
    });

    // All supplier documents (not purchase orders) in the invoice pipeline. They're linked to
    // suppliers, not the bank, so they're counted for the invoice_worker client directly.
    type SearchPage = { results: HsObject[]; paging?: { next?: { after?: string } } };
    const documents: { createdAt: string; stage: string; amount: number }[] = [];
    let after: string | undefined;
    do {
      const page: SearchPage = await hubspot("/crm/v3/objects/deals/search", {
        body: {
          filterGroups: [
            { filters: [{ propertyName: "pipeline", operator: "EQ", value: INVOICE_PIPELINE_ID }] },
          ],
          properties: ["createdate", "dealstage", "amount", "document_type"],
          limit: 200,
          ...(after ? { after } : {}),
        },
      });
      for (const d of page.results) {
        if ((d.properties["document_type"] ?? "").trim() === "purchase_order") continue;
        documents.push({
          createdAt: d.properties["createdate"] ?? "",
          stage: d.properties["dealstage"] ?? "",
          amount: num(d.properties["amount"]) ?? 0,
        });
      }
      after = page.paging?.next?.after;
    } while (after);

    const raw = res.results.map((o) => {
      const p = o.properties;
      const planKey = (p["appbuilder_plan"] ?? "").trim();
      return {
        id: o.id,
        name: p["name"] ?? "Unnamed company",
        plan: planKey ? (PLAN_LABELS[planKey] ?? planKey) : null,
        monthlyFee: num(p["appbuilder_monthly_fee"]),
        // Fee per processed document.
        feePerOrder: num(p["appbuilder_fee_per_order"]),
        start: (p["appbuilder_subscription_start"] ?? "").slice(0, 10) || null,
        paymentStatus: "",
      };
    });

    const now = new Date();
    const months = dashboardMonths(
      raw.map((c) => c.start),
      now,
    );

    const computed = raw.map((c) => {
      const billing = computeClientBilling(c, documents, months, INVOICE_NON_BILLABLE_STAGES, now);
      return { c, billing };
    });
    return {
      currency: CURRENCY,
      months,
      totals: computeTotals(
        computed.map(({ c, billing }) => ({ monthlyFee: c.monthlyFee, billing })),
      ),
      clients: computed.map(({ c, billing }) => ({
        ...c,
        ordersThisMonth: billing.ordersThisMonth,
        revenueThisMonth: billing.revenueThisMonth,
        revenueToDate: billing.revenueToDate,
        orderValueToDate: billing.orderValueToDate,
        monthly: billing.monthly,
      })),
    };
  });
