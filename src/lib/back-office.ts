// Back office. Client side (the bank's admins): edit purchase orders and suppliers in HubSpot
// (portal 149650024) and manage the bank's team. Platform side (AppBuilder.ai admins): all
// users and roles. Reads reuse listPurchaseOrders / listSuppliers from invoices.ts.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { isAdmin, requireAdmin, requireDeskAdmin } from "@/lib/admin";
import {
  normIban,
  P2P_PIPELINE_ID,
  PO_DOCUMENT_TYPE,
  poStageFor,
  poStageIdFor,
} from "@/lib/invoice-rules";

type HsObject = { id: string; properties: Record<string, string | null | undefined> };

export const SUPPLIER_STATUSES = ["approved", "pending_onboarding", "blocked"] as const;
export const ROLES = ["admin", "client_admin", "ap_reviewer"] as const;
export const TEAM_ROLES = ["ap_reviewer", "client_admin"] as const;

async function hs() {
  return (await import("@/lib/hubspot.server")).hubspot;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const DealId = z.string().regex(/^\d+$/);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const NewLine = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(60),
  quantity: z.number().positive().max(1_000_000),
  price: z.number().nonnegative().max(10_000_000),
});
const EditLine = NewLine.extend({
  id: z.string().regex(/^\d+$/).optional(),
  receivedQuantity: z.number().nonnegative().max(1_000_000),
  deliveryNoteRef: z.string().trim().max(60),
});

async function findPo(poNumber: string) {
  const hubspot = await hs();
  const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/deals/search", {
    body: {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: P2P_PIPELINE_ID },
            { propertyName: "document_type", operator: "EQ", value: PO_DOCUMENT_TYPE },
            { propertyName: "po_number", operator: "EQ", value: poNumber },
          ],
        },
      ],
      limit: 1,
    },
  });
  return res.results[0] ?? null;
}

async function readSupplier(companyId: string) {
  const hubspot = await hs();
  const company = await hubspot<HsObject>(
    `/crm/v3/objects/companies/${companyId}?properties=name,supplier_status,supplier_iban`,
  );
  if (!company.properties["supplier_status"]) throw new Error("This company isn't a supplier.");
  return company;
}

async function readPoDeal(dealId: string) {
  const hubspot = await hs();
  const deal = await hubspot<HsObject>(
    `/crm/v3/objects/deals/${dealId}?properties=pipeline,document_type,po_number&associations=line_items`,
  );
  if (
    deal.properties["pipeline"] !== P2P_PIPELINE_ID ||
    deal.properties["document_type"] !== PO_DOCUMENT_TYPE
  ) {
    throw new Error("This isn't a purchase order.");
  }
  const lineIds = (
    deal as HsObject & { associations?: { "line items"?: { results: { id: string }[] } } }
  ).associations?.["line items"]?.results.map((r) => String(r.id));
  return { deal, lineIds: new Set(lineIds ?? []) };
}

async function addLines(
  dealId: string,
  lines: (z.infer<typeof NewLine> & { receivedQuantity?: number; deliveryNoteRef?: string })[],
) {
  if (lines.length === 0) return;
  const hubspot = await hs();
  const created = await hubspot<{ results: { id: string }[] }>(
    "/crm/v3/objects/line_items/batch/create",
    {
      body: {
        inputs: lines.map((l) => ({
          properties: {
            name: l.name,
            hs_sku: l.sku,
            quantity: String(l.quantity),
            price: String(l.price),
            hs_line_item_currency_code: "EUR",
            received_quantity: String(l.receivedQuantity ?? 0),
            delivery_note_ref: l.deliveryNoteRef ?? "",
          },
        })),
      },
    },
  );
  await hubspot("/crm/v4/associations/line_items/deals/batch/associate/default", {
    body: { inputs: created.results.map((li) => ({ from: { id: li.id }, to: { id: dealId } })) },
  });
}

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator(
    (input: {
      supplierId: string;
      poNumber: string;
      budgetCode: string;
      requester: string;
      lines: z.infer<typeof NewLine>[];
    }) =>
      z
        .object({
          supplierId: DealId,
          poNumber: z.string().trim().min(3).max(40),
          budgetCode: z.string().trim().max(40),
          requester: z.string().trim().max(120),
          lines: z.array(NewLine).min(1).max(50),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const hubspot = await hs();
    if (await findPo(data.poNumber)) throw new Error(`${data.poNumber} already exists.`);
    const supplier = await readSupplier(data.supplierId);
    const amount = round2(data.lines.reduce((sum, l) => sum + l.quantity * l.price, 0));
    const deal = await hubspot<{ id: string }>("/crm/v3/objects/deals", {
      body: {
        properties: {
          dealname: `${data.poNumber} · ${supplier.properties["name"] ?? "Supplier"}`,
          deal_currency_code: "EUR",
          pipeline: P2P_PIPELINE_ID,
          dealstage: poStageIdFor("po_open"),
          document_type: PO_DOCUMENT_TYPE,
          amount: String(amount),
          po_number: data.poNumber,
          budget_code: data.budgetCode,
          po_requester: data.requester,
        },
      },
    });
    await hubspot(
      `/crm/v4/objects/deals/${deal.id}/associations/default/companies/${supplier.id}`,
      {
        method: "PUT",
      },
    );
    await addLines(deal.id, data.lines);
    return { id: deal.id };
  });

// Saves header fields and lines (edited and new). The stage follows the received
// quantities, unless the PO is closed.
export const updatePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator(
    (input: {
      dealId: string;
      budgetCode: string;
      requester: string;
      closed: boolean;
      lines: z.infer<typeof EditLine>[];
    }) =>
      z
        .object({
          dealId: DealId,
          budgetCode: z.string().trim().max(40),
          requester: z.string().trim().max(120),
          closed: z.boolean(),
          lines: z.array(EditLine).min(1).max(50),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const hubspot = await hs();
    const { deal, lineIds } = await readPoDeal(data.dealId);
    const existing = data.lines.filter((l) => l.id);
    if (existing.some((l) => !lineIds.has(l.id!))) {
      throw new Error("A line doesn't belong to this purchase order.");
    }
    if (existing.length !== lineIds.size) {
      throw new Error("Send every existing line; lines can't be removed here.");
    }
    if (existing.length > 0) {
      await hubspot("/crm/v3/objects/line_items/batch/update", {
        body: {
          inputs: existing.map((l) => ({
            id: l.id,
            properties: {
              name: l.name,
              hs_sku: l.sku,
              quantity: String(l.quantity),
              price: String(l.price),
              received_quantity: String(l.receivedQuantity),
              delivery_note_ref: l.deliveryNoteRef,
            },
          })),
        },
      });
    }
    await addLines(
      deal.id,
      data.lines.filter((l) => !l.id),
    );
    const stage = poStageFor(data.lines, data.closed);
    await hubspot(`/crm/v3/objects/deals/${deal.id}`, {
      method: "PATCH",
      body: {
        properties: {
          budget_code: data.budgetCode,
          po_requester: data.requester,
          dealstage: poStageIdFor(stage),
          amount: String(round2(data.lines.reduce((sum, l) => sum + l.quantity * l.price, 0))),
        },
      },
    });
    return { stage };
  });

const SupplierFields = z.object({
  name: z.string().trim().min(2).max(120),
  status: z.enum(SUPPLIER_STATUSES),
  vatId: z.string().trim().max(30),
  iban: z.string().trim().max(40),
  certificateValidUntil: IsoDate.or(z.literal("")),
});
type SupplierInput = z.infer<typeof SupplierFields>;

async function vatTaken(vatId: string, exceptId?: string) {
  if (!vatId) return false;
  const hubspot = await hs();
  const res = await hubspot<{ results: HsObject[] }>("/crm/v3/objects/companies/search", {
    body: {
      filterGroups: [
        { filters: [{ propertyName: "supplier_vat_id", operator: "EQ", value: vatId }] },
      ],
      limit: 2,
    },
  });
  return res.results.some((c) => c.id !== exceptId);
}

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator((input: SupplierInput & { domain: string }) =>
    SupplierFields.extend({ domain: z.string().trim().max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const hubspot = await hs();
    if (await vatTaken(data.vatId))
      throw new Error(`A supplier with VAT ID ${data.vatId} already exists.`);
    const company = await hubspot<{ id: string }>("/crm/v3/objects/companies", {
      body: {
        properties: {
          name: data.name,
          ...(data.domain ? { domain: data.domain } : {}),
          supplier_status: data.status,
          supplier_vat_id: data.vatId,
          supplier_iban: normIban(data.iban),
          tax_certificate_valid_until: data.certificateValidUntil,
        },
      },
    });
    return { id: company.id };
  });

// An IBAN change keeps the old one and the date, which the invoice worker checks
// (an invoice within 30 days of a change goes to Needs review).
export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator((input: SupplierInput & { companyId: string }) =>
    SupplierFields.extend({ companyId: DealId }).parse(input),
  )
  .handler(async ({ data }) => {
    const hubspot = await hs();
    const company = await readSupplier(data.companyId);
    if (await vatTaken(data.vatId, company.id)) {
      throw new Error(`Another supplier already has VAT ID ${data.vatId}.`);
    }
    const oldIban = normIban(company.properties["supplier_iban"]);
    const newIban = normIban(data.iban);
    const ibanChanged = oldIban !== newIban;
    await hubspot(`/crm/v3/objects/companies/${company.id}`, {
      method: "PATCH",
      body: {
        properties: {
          name: data.name,
          supplier_status: data.status,
          supplier_vat_id: data.vatId,
          supplier_iban: newIban,
          tax_certificate_valid_until: data.certificateValidUntil,
          ...(ibanChanged ? { previous_iban: oldIban, iban_changed_on: today() } : {}),
        },
      },
    });
    return { ibanChanged };
  });

// ---------- users and roles (public.user_roles, service role only) ----------

export type RoleUser = { id: string; email: string; createdAt: string; roles: string[] };

async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

async function writeRole(userId: string, role: string, enabled: boolean) {
  const db = await adminClient();
  const { error } = enabled
    ? await db
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true })
    : await db.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error?.code === "22P02") throw new Error(`The ${role} role needs its database update first.`);
  if (error) throw new Error(error.message);
}

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<RoleUser[]> =>
    (await readUsersAndRoles()).sort((a, b) => a.email.localeCompare(b.email)),
  );

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; role: (typeof ROLES)[number]; enabled: boolean }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(ROLES), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && data.role === "admin" && !data.enabled) {
      throw new Error("You can't remove your own admin role.");
    }
    await writeRole(data.userId, data.role, data.enabled);
  });

// ---------- the client's own team (client admins) ----------

async function readUsersAndRoles() {
  const db = await adminClient();
  const [{ data: users, error }, { data: roles, error: rolesError }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 200 }),
    db.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw new Error(error.message);
  if (rolesError) throw new Error(rolesError.message);
  const byUser = new Map<string, string[]>();
  for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  }
  return users.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    createdAt: u.created_at,
    roles: byUser.get(u.id) ?? [],
  }));
}

const isTeamRole = (r: string) => (TEAM_ROLES as readonly string[]).includes(r);

// Only people with a desk role, and never platform staff, so a client admin can't see
// other clients' users or change AppBuilder.ai's own accounts.
export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireDeskAdmin])
  .handler(async (): Promise<RoleUser[]> =>
    (await readUsersAndRoles())
      .filter((u) => !u.roles.includes("admin") && u.roles.some(isTeamRole))
      .map((u) => ({ ...u, roles: u.roles.filter(isTeamRole) }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  );

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().trim().toLowerCase().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = (await readUsersAndRoles()).find((u) => u.email.toLowerCase() === data.email);
    if (!user) throw new Error("No account with that email yet. Ask them to sign up first.");
    if (user.roles.includes("admin")) throw new Error("That's an AppBuilder.ai account.");
    await writeRole(user.id, "ap_reviewer", true);
  });

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireDeskAdmin])
  .inputValidator(
    (input: { userId: string; role: (typeof TEAM_ROLES)[number]; enabled: boolean }) =>
      z
        .object({ userId: z.string().uuid(), role: z.enum(TEAM_ROLES), enabled: z.boolean() })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (await isAdmin(data.userId))
      throw new Error("AppBuilder.ai accounts are managed by the platform.");
    if (data.userId === context.userId && data.role === "client_admin" && !data.enabled) {
      throw new Error("You can't remove your own admin role.");
    }
    await writeRole(data.userId, data.role, data.enabled);
  });
