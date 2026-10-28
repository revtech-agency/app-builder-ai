// Admin revenue dashboard backed by HubSpot (portal 149650024): client companies, their
// AppBuilder plan properties and their order deals. Read-only.
import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/admin";
import { computeClientBilling, computeTotals, CURRENCY, dashboardMonths } from "@/lib/billing";
import type { DashboardTotals, MonthBilling } from "@/lib/billing";
import { PIPELINE_ID } from "@/lib/order-rules";

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

const PLAN_LABELS: Record<string, string> = { order_worker: "Order worker" };

const num = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

const chunk = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const getPlatformDashboard = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<PlatformDashboard> => {
    const { hubspot } = await import("@/lib/hubspot.server");

    const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
      body: {
        filterGroups: [{ filters: [{ propertyName: "payment_status", operator: "HAS_PROPERTY" }] }],
        properties: [
          "name",
          "payment_status",
          "appbuilder_plan",
          "appbuilder_monthly_fee",
          "appbuilder_fee_per_order",
          "appbuilder_subscription_start",
        ],
        sorts: [{ propertyName: "name", direction: "ASCENDING" }],
        limit: 100,
      },
    });

    type AssocPage = {
      results: { toObjectId: number | string }[];
      paging?: { next?: { after?: string } };
    };
    const ordersOf = async (companyId: string) => {
      const dealIds: string[] = [];
      let after: string | undefined;
      do {
        const page: AssocPage = await hubspot(
          `/crm/v4/objects/companies/${companyId}/associations/deals?limit=500${after ? `&after=${after}` : ""}`,
        );
        dealIds.push(...page.results.map((r) => String(r.toObjectId)));
        after = page.paging?.next?.after;
      } while (after);
      const batches = await Promise.all(
        chunk(dealIds, 100).map((ids) =>
          hubspot<{ results: HsObject[] }>("/crm/v3/objects/deals/batch/read", {
            body: {
              properties: ["pipeline", "createdate", "dealstage", "amount"],
              inputs: ids.map((id) => ({ id })),
            },
          }),
        ),
      );
      return batches
        .flatMap((b) => b.results)
        .filter((d) => d.properties["pipeline"] === PIPELINE_ID)
        .map((d) => ({
          createdAt: d.properties["createdate"] ?? "",
          stage: d.properties["dealstage"] ?? "",
          amount: num(d.properties["amount"]) ?? 0,
        }));
    };

    const raw = res.results.map((o) => {
      const p = o.properties;
      const planKey = (p["appbuilder_plan"] ?? "").trim();
      return {
        id: o.id,
        name: p["name"] ?? "Unnamed company",
        plan: planKey ? (PLAN_LABELS[planKey] ?? planKey) : null,
        monthlyFee: num(p["appbuilder_monthly_fee"]),
        feePerOrder: num(p["appbuilder_fee_per_order"]),
        start: (p["appbuilder_subscription_start"] ?? "").slice(0, 10) || null,
        paymentStatus: (p["payment_status"] ?? "").trim().toLowerCase(),
      };
    });

    const now = new Date();
    const months = dashboardMonths(
      raw.map((c) => c.start),
      now,
    );
    const orders = await Promise.all(raw.map((c) => ordersOf(c.id)));

    const computed = raw.map((c, i) => {
      const billing = computeClientBilling(c, orders[i] ?? [], months, now);
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
