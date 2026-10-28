// Founder auth on Lovable Cloud (Supabase Auth, email + password).
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getApDemoSignIn, getDemoSignIn, getMyRole } from "@/lib/admin";

type AuthUser = { id: string; name: string; email: string };

type AuthContextValue = {
  user: AuthUser | null;
  // False until the stored session has been read on the client, so SSR and first render match.
  ready: boolean;
  isAdmin: boolean;
  canUseInvoiceDesk: boolean;
  // Client admin (or platform admin): may edit POs, suppliers and the client's team.
  canManageDesk: boolean;
  // True once the roles above are known for the signed-in user.
  rolesReady: boolean;
  // Signed in as the shared invoice desk demo account (shows the demo guide).
  isDemo: boolean;
  signInApDemo: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  // Resolves to true when Supabase wants the founder to confirm their email first.
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const email = u.email ?? "";
  const name =
    (u.user_metadata?.["name"] as string | undefined) || email.split("@")[0] || "Founder";
  return { id: u.id, name, email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Subscribe first so a session restored during getSession isn't missed.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);
  const [canUseInvoiceDesk, setCanUseInvoiceDesk] = useState(false);
  const [canManageDesk, setCanManageDesk] = useState(false);
  const [rolesReady, setRolesReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const userId = session?.user.id;
  useEffect(() => {
    setIsAdmin(false);
    setCanUseInvoiceDesk(false);
    setCanManageDesk(false);
    setRolesReady(false);
    setIsDemo(false);
    if (!userId) return;
    let current = true;
    getMyRole()
      .then((role) => {
        if (!current) return;
        setIsAdmin(role.isAdmin);
        setCanUseInvoiceDesk(role.canUseInvoiceDesk);
        setCanManageDesk(role.canManageDesk);
        setIsDemo(role.isDemo);
        setRolesReady(true);
      })
      .catch(() => {
        if (!current) return;
        setIsAdmin(false);
        setRolesReady(true);
      });
    return () => {
      current = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInDemo = useCallback(async () => {
    const { tokenHash } = await getDemoSignIn();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) throw error;
  }, []);

  const signInApDemo = useCallback(async () => {
    const { tokenHash } = await getApDemoSignIn();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${window.location.origin}/app` },
    });
    if (error) throw error;
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      user: toUser(session),
      ready,
      isAdmin,
      canUseInvoiceDesk,
      canManageDesk,
      rolesReady,
      isDemo,
      signIn,
      signInDemo,
      signInApDemo,
      signUp,
      signOut,
    }),
    [
      session,
      ready,
      isAdmin,
      canUseInvoiceDesk,
      canManageDesk,
      rolesReady,
      isDemo,
      signIn,
      signInDemo,
      signInApDemo,
      signUp,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
