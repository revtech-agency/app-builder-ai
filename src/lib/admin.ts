// Roles live in public.user_roles (see lovable-prompt-roles.md); only the server writes them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = { id: string; email: string; createdAt: string; isAdmin: boolean };

// Service-role client, loaded inside handlers so it never reaches the browser bundle.
// Untyped until the generated Database types include user_roles.
async function adminClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const db = await adminClient();
  const { data, error } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    // Roles table not created yet (PostgREST PGRST205): nobody is an admin, but
    // customer and demo sign-ins keep working.
    if (error.code === "PGRST205") return false;
    throw new Error(`Could not check roles: ${error.message}`);
  }
  return Boolean(data);
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const db = await adminClient();
  const { data, error } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  if (error) {
    if (error.code === "PGRST205") return false;
    throw new Error(`Could not check roles: ${error.message}`);
  }
  return Boolean(data);
}

export async function canUseInvoiceDesk(userId: string): Promise<boolean> {
  const [reviewer, admin] = await Promise.all([hasRole(userId, "ap_reviewer"), isAdmin(userId)]);
  return reviewer || admin;
}

export const requireInvoiceDesk = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    if (!(await canUseInvoiceDesk(context.userId))) {
      throw new Error("Only invoice desk reviewers can do this.");
    }
    return next();
  });

export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Only admins can do this.");
    return next();
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: await isAdmin(context.userId),
    canUseInvoiceDesk: await canUseInvoiceDesk(context.userId),
  }));

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminUser[]> => {
    const db = await adminClient();
    const [{ data: users, error }, { data: roles, error: rolesError }] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 200 }),
      db.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    if (error) throw new Error(error.message);
    if (rolesError) throw new Error(rolesError.message);
    const admins = new Set((roles ?? []).map((r: { user_id: string }) => r.user_id));
    return users.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        isAdmin: admins.has(u.id),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  });

export const setAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((input: { userId: string; admin: boolean }) =>
    z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId && !data.admin) {
      throw new Error("You can't remove your own admin role.");
    }
    const db = await adminClient();
    const { error } = data.admin
      ? await db
          .from("user_roles")
          .upsert(
            { user_id: data.userId, role: "admin" },
            { onConflict: "user_id,role", ignoreDuplicates: true },
          )
      : await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (error) throw new Error(error.message);
  });

// One-click demo: a one-time sign-in token for the shared demo account, redeemed in the
// browser with verifyOtp. No password is stored or sent anywhere.
export const getDemoSignIn = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["DEMO_EMAIL"] || "demo@appbuilder.ai";
  const db = await adminClient();
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error("The demo account isn't set up yet.");
  }
  if (await isAdmin(data.user.id)) throw new Error("The demo account must not be an admin.");
  return { tokenHash: data.properties.hashed_token };
});

// Invoice desk demo: same one-time token flow, for the AP reviewer demo account.
const apDemoEmail = () => process.env["DEMO_AP_EMAIL"] || "ap-demo@appbuilder.ai";

export const getApDemoAvailable = createServerFn({ method: "GET" }).handler(async () => ({
  available: Boolean(apDemoEmail()),
}));

export const getApDemoSignIn = createServerFn({ method: "POST" }).handler(async () => {
  const db = await adminClient();
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: apDemoEmail(),
  });
  if (error || !data.properties?.hashed_token) {
    throw new Error("The invoice desk demo account isn't set up yet.");
  }
  if (await isAdmin(data.user.id)) throw new Error("The demo account must not be an admin.");
  if (!(await hasRole(data.user.id, "ap_reviewer"))) {
    throw new Error("The demo account isn't an invoice desk reviewer.");
  }
  return { tokenHash: data.properties.hashed_token };
});
