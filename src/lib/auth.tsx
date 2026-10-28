// Placeholder auth to be replaced by Lovable Cloud auth.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const DEMO_FOUNDER = { name: "Demo Founder", email: "demo@appbuilder.ai" };

const STORAGE_KEY = "appbuilder_demo_signed_in";

type AuthContextValue = {
  user: typeof DEMO_FOUNDER | null;
  // False until localStorage has been read on the client, so SSR and first render match.
  ready: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(signedIn: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (signedIn) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode etc.): the session just lasts until reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedIn(readFlag());
    setReady(true);
  }, []);

  const signIn = useCallback(() => {
    writeFlag(true);
    setSignedIn(true);
  }, []);

  const signOut = useCallback(() => {
    writeFlag(false);
    setSignedIn(false);
  }, []);

  const value = useMemo(
    () => ({ user: signedIn ? DEMO_FOUNDER : null, ready, signIn, signOut }),
    [signedIn, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
