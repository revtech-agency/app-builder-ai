// Roles live in public.user_roles (see lovable-prompt-roles.md); only the server writes them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMiddleware, createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    // PGRST205: roles table missing. 22P02: the role isn't in the app_role enum yet
    // (client_admin before its migration), so nobody has it.
    if (error.code === "PGRST205" || error.code === "22P02") return false;
    throw new Error(`Could not check roles: ${error.message}`);
  }
  return Boolean(data);
}

// Client side (the bank): reviewers work the invoice desk; client admins also edit POs,
// suppliers and their team. Platform admins (AppBuilder.ai staff) keep support access to both.
export async function canManageDesk(userId: string): Promise<boolean> {
  const [clientAdmin, admin] = await Promise.all([
    hasRole(userId, "client_admin"),
    isAdmin(userId),
  ]);
  return clientAdmin || admin;
}

export async function canUseInvoiceDesk(userId: string): Promise<boolean> {
  const [reviewer, manager] = await Promise.all([
    hasRole(userId, "ap_reviewer"),
    canManageDesk(userId),
  ]);
  return reviewer || manager;
}

export const requireDeskAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    if (!(await canManageDesk(context.userId))) {
      throw new Error("Only the client's admins can do this.");
    }
    return next();
  });

// The public one-click demo ("Try the demo") is off unless DEMO_ENABLED is "true" in the
// deploy settings. While it's off, nobody can sign in to the two shared demo accounts, and
// sessions they already hold can't use the invoice desk or the order portal.
export const demoEnabled = () => process.env["DEMO_ENABLED"] === "true";

const casingsDemoEmail = () => process.env["DEMO_EMAIL"] || "demo@appbuilder.ai";

export function isDemoAccount(email: string | undefined) {
  const e = (email ?? "").trim().toLowerCase();
  return e !== "" && (e === casingsDemoEmail().toLowerCase() || e === apDemoEmail().toLowerCase());
}

const DEMO_CLOSED = "The public demo is closed. Get in touch for a guided demo.";

export const getDemoStatus = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: demoEnabled(),
}));

export const requireInvoiceDesk = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    if (!demoEnabled() && isDemoAccount((context.claims as { email?: string }).email)) {
      throw new Error(DEMO_CLOSED);
    }
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

// New accounts have no role: a desk admin adds them on the Team page after they sign up, so a
// stranger who signs up can't see suppliers' bank details or approve invoices.
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return {
      isAdmin: await isAdmin(context.userId),
      canUseInvoiceDesk: await canUseInvoiceDesk(context.userId),
      canManageDesk: await canManageDesk(context.userId),
      // The shared invoice desk demo account sees the step-by-step demo guide.
      isDemo:
        ((context.claims as { email?: string }).email ?? "").toLowerCase() ===
        apDemoEmail().toLowerCase(),
    };
  });

// One-click demo: a one-time sign-in token for the shared demo account, redeemed in the
// browser with verifyOtp. No password is stored or sent anywhere.
export const getDemoSignIn = createServerFn({ method: "POST" }).handler(async () => {
  if (!demoEnabled()) throw new Error(DEMO_CLOSED);
  const email = casingsDemoEmail();
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

// "Reset demo" archives every invoice except the samples, so only the shared demo account and
// platform admins may run it; real reviewers' invoices are never at risk.
export const requireDemoReset = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = ((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (email !== apDemoEmail().toLowerCase() && !(await isAdmin(context.userId))) {
      throw new Error("Only the demo account and AppBuilder.ai admins can reset the demo.");
    }
    return next();
  });

export const getApDemoSignIn = createServerFn({ method: "POST" }).handler(async () => {
  if (!demoEnabled()) throw new Error(DEMO_CLOSED);
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
