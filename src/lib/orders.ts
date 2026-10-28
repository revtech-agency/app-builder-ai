// Customer ordering backed by HubSpot (portal 149650024) and the n8n order assistant.
// Every function checks the caller may see the company; HubSpot and n8n tokens stay server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin } from "@/lib/admin";
import { evaluateLine, orderStage, PIPELINE_ID, STAGE_IDS, STAGES } from "@/lib/order-rules";
import type { OrderStage } from "@/lib/order-rules";

const DEMO_COMPANY_ID = "458454559952";

export type CompanyInfo = { id: string; name: string };

export type OrderLine = {
  id: string;
  name: string;
  packs: number;
  metres: number;
  price: number;
  amount: number;
  roundingNote: string | null;
};

export type Order = {
  id: string;
  ref: string;
  createdAt: string;
  deliveryDate: string | null;
  stage: string;
  stageLabel: string;
  amount: number;
  channel: string | null;
  exceptionReason: string | null;
  lines: OrderLine[];
  quoteLink: string | null;
  quotePdf: string | null;
  quoteNumber: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  casingFamily: string | null;
  calibreMm: number | null;
  colour: string | null;
  packType: string | null;
  unitsPerPack: number;
  minSalePacks: number | null;
  price: number;
  pricePerMetre: number | null;
  stockPacks: number | null;
  orderable: boolean;
};

export type ChatCartLine = {
  sku: string;
  product_id?: string | undefined;
  name: string;
  metres: number;
  metres_per_pack?: number | undefined;
  min_sale_packs?: number | undefined;
  price_per_pack?: number | undefined;
  stock_packs?: number | undefined;
};

export type ChatReply = { reply: string; delivery_date?: string | undefined; cart: ChatCartLine[] };

export type PlaceOrderResult = {
  ref: string;
  stage: string;
  stageLabel: string;
  dealId: string;
  amount: number;
  offerSent: boolean;
  offerError?: string | undefined;
  notes: string[];
};

type Props = Record<string, string | null | undefined>;
type HsObject = { id: string; properties: Props };

type Company = {
  id: string;
  name: string;
  domain: string;
  paymentStatus: string;
  negotiatedSkus: string[];
};

const num = (v: string | null | undefined) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
};

const chunk = <T>(items: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const skuKey = (sku: string) => sku.trim().toUpperCase();

const COMPANY_PROPS = ["name", "domain", "payment_status", "negotiated_skus"];

function toCompany(o: HsObject): Company {
  return {
    id: o.id,
    name: o.properties["name"] ?? "Unnamed company",
    domain: (o.properties["domain"] ?? "").trim().toLowerCase(),
    paymentStatus: (o.properties["payment_status"] ?? "").trim().toLowerCase(),
    negotiatedSkus: (o.properties["negotiated_skus"] ?? "")
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

type Caller = { userId: string; email: string };

async function visibleCompanies(caller: Caller): Promise<Company[]> {
  const { hubspot } = await import("@/lib/hubspot.server");
  const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
    body: {
      filterGroups: [{ filters: [{ propertyName: "payment_status", operator: "HAS_PROPERTY" }] }],
      properties: COMPANY_PROPS,
      sorts: [{ propertyName: "name", direction: "ASCENDING" }],
      limit: 100,
    },
  });
  const all = res.results.map(toCompany);
  if (await isAdmin(caller.userId)) return all;

  const email = caller.email.trim().toLowerCase();
  const demoEmail = (process.env["DEMO_EMAIL"] || "demo@appbuilder.ai").toLowerCase();
  if (email === demoEmail) return all.filter((c) => c.id === DEMO_COMPANY_ID);

  const domain = email.split("@")[1];
  if (!domain) return [];
  // Domain matching is only safe for confirmed addresses; otherwise anyone could sign up
  // as someone@client-domain and see that client's orders.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(caller.userId);
  if (!data.user?.email_confirmed_at) return [];
  return all.filter((c) => c.domain === domain);
}

async function requireCompany(caller: Caller, companyId: string): Promise<Company> {
  const company = (await visibleCompanies(caller)).find((c) => c.id === companyId);
  if (!company) throw new Error("You don't have access to this company.");
  return company;
}

function callerOf(context: { userId: string; claims: unknown }): Caller {
  const email = (context.claims as { email?: string }).email ?? "";
  return { userId: context.userId, email };
}

const PRODUCT_PROPS = [
  "name",
  "hs_sku",
  "casing_family",
  "calibre_mm",
  "colour",
  "pack_type",
  "units_per_pack",
  "min_sale_packs",
  "price",
  "price_per_metre",
  "stock_packs",
];

function toItem(o: HsObject, orderable: boolean): InventoryItem {
  const p = o.properties;
  return {
    id: o.id,
    name: p["name"] ?? "",
    sku: p["hs_sku"] ?? "",
    casingFamily: p["casing_family"] || null,
    calibreMm: num(p["calibre_mm"]),
    colour: p["colour"] || null,
    packType: p["pack_type"] || null,
    unitsPerPack: num(p["units_per_pack"]) ?? 0,
    minSalePacks: num(p["min_sale_packs"]),
    price: num(p["price"]) ?? 0,
    pricePerMetre: num(p["price_per_metre"]),
    stockPacks: num(p["stock_packs"]),
    orderable,
  };
}

const CompanyInput = z.object({ companyId: z.string().regex(/^\d+$/) });

export const getMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyInfo[]> => {
    const companies = await visibleCompanies(callerOf(context));
    return companies.map((c) => ({ id: c.id, name: c.name }));
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => CompanyInput.parse(input))
  .handler(async ({ data, context }): Promise<Order[]> => {
    await requireCompany(callerOf(context), data.companyId);
    const { hubspot } = await import("@/lib/hubspot.server");

    type AssocPage = {
      results: { toObjectId: number | string }[];
      paging?: { next?: { after?: string } };
    };
    const dealIds: string[] = [];
    let after: string | undefined;
    do {
      const page: AssocPage = await hubspot(
        `/crm/v4/objects/companies/${data.companyId}/associations/deals?limit=500${after ? `&after=${after}` : ""}`,
      );
      dealIds.push(...page.results.map((r) => String(r.toObjectId)));
      after = page.paging?.next?.after;
    } while (after);
    if (dealIds.length === 0) return [];

    const dealProps = [
      "dealname",
      "dealstage",
      "pipeline",
      "amount",
      "delivery_date",
      "createdate",
      "order_channel",
      "exception_reason",
    ];
    const dealBatches = await Promise.all(
      chunk(dealIds, 100).map((ids) =>
        hubspot<{ results: HsObject[] }>("/crm/v3/objects/deals/batch/read", {
          body: { properties: dealProps, inputs: ids.map((id) => ({ id })) },
        }),
      ),
    );
    const deals = dealBatches
      .flatMap((b) => b.results)
      .filter((d) => d.properties["pipeline"] === PIPELINE_ID)
      .sort((a, b) =>
        (b.properties["createdate"] ?? "").localeCompare(a.properties["createdate"] ?? ""),
      )
      .slice(0, 50);
    if (deals.length === 0) return [];

    type AssocBatch = {
      results: { from: { id: string }; to: { toObjectId: number | string }[] }[];
    };
    const readAssoc = async (toType: "line_items" | "quotes") => {
      const batches = await Promise.all(
        chunk(deals, 100).map((ds) =>
          hubspot<AssocBatch>(`/crm/v4/associations/deals/${toType}/batch/read`, {
            body: { inputs: ds.map((d) => ({ id: d.id })) },
          }),
        ),
      );
      const map = new Map<string, string[]>();
      for (const r of batches.flatMap((b) => b.results)) {
        map.set(
          String(r.from.id),
          r.to.map((t) => String(t.toObjectId)),
        );
      }
      return map;
    };
    const readObjects = async (type: string, ids: string[], properties: string[]) => {
      const batches = await Promise.all(
        chunk([...new Set(ids)], 100).map((c) =>
          hubspot<{ results: HsObject[] }>(`/crm/v3/objects/${type}/batch/read`, {
            body: { properties, inputs: c.map((id) => ({ id })) },
          }),
        ),
      );
      return new Map(batches.flatMap((b) => b.results).map((o) => [o.id, o]));
    };

    const [lineAssoc, quoteAssoc] = await Promise.all([
      readAssoc("line_items"),
      readAssoc("quotes"),
    ]);
    const [lineObjs, quoteObjs] = await Promise.all([
      readObjects("line_items", [...lineAssoc.values()].flat(), [
        "name",
        "quantity",
        "price",
        "amount",
        "ordered_quantity",
        "rounding_note",
      ]),
      readObjects("quotes", [...quoteAssoc.values()].flat(), [
        "hs_quote_link",
        "hs_pdf_download_link",
        "hs_quote_number",
        "hs_createdate",
      ]),
    ]);

    return deals.map((d): Order => {
      const p = d.properties;
      const dname = p["dealname"] ?? "";
      const stage = STAGES[p["dealstage"] ?? ""];
      const quote = (quoteAssoc.get(d.id) ?? [])
        .map((id) => quoteObjs.get(id))
        .filter((q): q is HsObject => Boolean(q))
        .at(-1);
      return {
        id: d.id,
        ref: dname.split(" · ")[0] || dname,
        createdAt: p["createdate"] ?? "",
        deliveryDate: p["delivery_date"] || null,
        stage: stage?.key ?? "received",
        stageLabel: stage?.label ?? "Received",
        amount: num(p["amount"]) ?? 0,
        channel: p["order_channel"] || null,
        exceptionReason: p["exception_reason"] || null,
        lines: (lineAssoc.get(d.id) ?? [])
          .map((id) => lineObjs.get(id))
          .filter((l): l is HsObject => Boolean(l))
          .map((l) => ({
            id: l.id,
            name: l.properties["name"] ?? "",
            packs: num(l.properties["quantity"]) ?? 0,
            metres: num(l.properties["ordered_quantity"]) ?? 0,
            price: num(l.properties["price"]) ?? 0,
            amount: num(l.properties["amount"]) ?? 0,
            roundingNote: l.properties["rounding_note"] || null,
          })),
        quoteLink: quote?.properties["hs_quote_link"] || null,
        quotePdf: quote?.properties["hs_pdf_download_link"] || null,
        quoteNumber: quote?.properties["hs_quote_number"] || null,
      };
    });
  });

export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => CompanyInput.parse(input))
  .handler(async ({ data, context }): Promise<InventoryItem[]> => {
    const company = await requireCompany(callerOf(context), data.companyId);
    const { hubspot } = await import("@/lib/hubspot.server");
    const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/products/search", {
      body: {
        filterGroups: [{ filters: [{ propertyName: "hs_sku", operator: "HAS_PROPERTY" }] }],
        properties: PRODUCT_PROPS,
        sorts: [{ propertyName: "name", direction: "ASCENDING" }],
        limit: 200,
      },
    });
    const allowed = new Set(company.negotiatedSkus.map(skuKey));
    return res.results.map((o) =>
      toItem(o, allowed.size === 0 || allowed.has(skuKey(o.properties["hs_sku"] ?? ""))),
    );
  });

const CartLineSchema = z.object({
  sku: z.string(),
  product_id: z.string().optional(),
  name: z.string(),
  metres: z.number(),
  metres_per_pack: z.number().optional(),
  min_sale_packs: z.number().optional(),
  price_per_pack: z.number().optional(),
  stock_packs: z.number().optional(),
});

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; sessionId: string; message: string; cart: ChatCartLine[] }) =>
      z
        .object({
          companyId: z.string().regex(/^\d+$/),
          sessionId: z.string().min(1).max(100),
          message: z.string().trim().min(1).max(4000),
          cart: z.array(CartLineSchema).max(100),
        })
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<ChatReply> => {
    const company = await requireCompany(callerOf(context), data.companyId);
    const { n8n } = await import("@/lib/hubspot.server");
    const reply = await n8n<Partial<ChatReply>>("order-assistant", {
      session_id: `${context.userId}:${company.id}:${data.sessionId}`,
      client_name: company.name,
      negotiated_skus: company.negotiatedSkus,
      message: data.message,
      cart: data.cart,
    });
    return {
      reply: reply.reply ?? "",
      delivery_date: reply.delivery_date || undefined,
      cart: Array.isArray(reply.cart) ? reply.cart : [],
    };
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      deliveryDate: string;
      lines: { sku: string; metres: number }[];
    }) =>
      z
        .object({
          companyId: z.string().regex(/^\d+$/),
          deliveryDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
          lines: z
            .array(z.object({ sku: z.string().min(1), metres: z.number().positive() }))
            .min(1)
            .max(100),
        })
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<PlaceOrderResult> => {
    const caller = callerOf(context);
    const company = await requireCompany(caller, data.companyId);
    const { hubspot, n8n } = await import("@/lib/hubspot.server");
    const { randomBytes } = await import("node:crypto");

    // Re-read products from HubSpot: prices and stock are never taken from the browser.
    const skus = [...new Set(data.lines.map((l) => l.sku.trim()))];
    const found = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/products/search", {
      body: {
        filterGroups: [{ filters: [{ propertyName: "hs_sku", operator: "IN", values: skus }] }],
        properties: PRODUCT_PROPS,
        limit: 200,
      },
    });
    const products = new Map(found.results.map((o) => [skuKey(o.properties["hs_sku"] ?? ""), o]));
    const allowed = new Set(company.negotiatedSkus.map(skuKey));

    const prepared = data.lines.map((line) => {
      const key = skuKey(line.sku);
      const product = products.get(key);
      if (!product) throw new Error(`Unknown product ${line.sku}.`);
      if (allowed.size > 0 && !allowed.has(key)) {
        throw new Error(`${line.sku} isn't available to order for ${company.name}.`);
      }
      const item = toItem(product, true);
      if (item.unitsPerPack <= 0) throw new Error(`${item.sku} has no pack size configured.`);
      const ev = evaluateLine({
        metres: line.metres,
        unitsPerPack: item.unitsPerPack,
        minSalePacks: item.minSalePacks,
        packType: item.packType,
        stockPacks: item.stockPacks,
      });
      return { line, item, ev, note: [ev.roundingNote, ev.stockNote].filter(Boolean).join("; ") };
    });

    const notes = prepared.flatMap((p) =>
      [p.ev.roundingNote, p.ev.stockNote]
        .filter((n): n is string => Boolean(n))
        .map((n) => `${p.item.sku}: ${n}`),
    );
    if (!data.deliveryDate) notes.push("No delivery date given");
    if (company.paymentStatus === "overdue") notes.push("Account payment is overdue");

    const stage: OrderStage = orderStage(
      prepared.map((p) => p.ev),
      Boolean(data.deliveryDate),
      company.paymentStatus,
    );
    const stageId = STAGE_IDS[stage];
    const amount =
      Math.round(prepared.reduce((sum, p) => sum + p.ev.packs * p.item.price, 0) * 100) / 100;

    const token = randomBytes(8).toString("hex");
    const ref = `ORD-${token.slice(-6).toUpperCase()}`;
    const summary = prepared
      .map((p) => `${p.item.sku} ${p.item.name}: ${p.line.metres} m (${p.ev.packs} packs)`)
      .join("\n");

    const deal = await hubspot<{ id: string }>("/crm/v3/objects/deals", {
      body: {
        properties: {
          dealname: `${ref} · ${company.name}`,
          pipeline: PIPELINE_ID,
          dealstage: stageId,
          amount: String(amount),
          ...(data.deliveryDate ? { delivery_date: data.deliveryDate } : {}),
          order_channel: "app",
          source_message_id: `app-${token}`,
          raw_order_text: summary,
          exception_reason: notes.join("; "),
          min_field_confidence: "1",
        },
        associations: [
          {
            to: { id: company.id },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }],
          },
        ],
      },
    });

    const created = await hubspot<{ results: { id: string }[] }>(
      "/crm/v3/objects/line_items/batch/create",
      {
        body: {
          inputs: prepared.map((p) => ({
            properties: {
              hs_product_id: p.item.id,
              name: p.item.name,
              quantity: String(p.ev.packs),
              price: String(p.item.price),
              ordered_quantity: String(p.line.metres),
              ordered_unit: "m",
              client_code_as_written: p.item.sku,
              rounding_note: p.ev.roundingNote ?? "",
              field_confidence: "1",
            },
            associations: [
              {
                to: { id: deal.id },
                types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 20 }],
              },
            ],
          })),
        },
      },
    );

    let offerSent = false;
    let offerError: string | undefined;
    if (stage === "ready" || stage === "waiting") {
      try {
        await n8n("app-order-offer", {
          deal_id: deal.id,
          token,
          to: caller.email,
          client_name: company.name,
          order_ref: ref,
          delivery_date: data.deliveryDate,
          intro: `Thanks for your order ${ref}. Here is what we have prepared for you.${
            notes.length ? ` Please note: ${notes.join("; ")}.` : ""
          }`,
          line_item_ids: created.results.map((r) => r.id),
          lines: prepared.map((p) => ({
            client_code: p.item.sku,
            name: p.item.name,
            packs: p.ev.packs,
            metres_per_pack: p.item.unitsPerPack,
            price_per_pack: p.item.price,
            note: p.note,
          })),
        });
        offerSent = true;
      } catch (e) {
        offerError = e instanceof Error ? e.message : "Could not send the offer email.";
      }
    }

    const info = STAGES[stageId];
    return {
      ref,
      stage: info?.key ?? "received",
      stageLabel: info?.label ?? "Received",
      dealId: deal.id,
      amount,
      offerSent,
      offerError,
      notes,
    };
  });
