import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getApDemoSignIn, getDemoSignIn, getDemoStatus } from "@/lib/admin";

import { Button } from "@/components/ui/button";

// Whether the public one-click demo is open (DEMO_ENABLED on the server). Treated as closed
// until the answer arrives, so a closed demo never flashes a working button.
// eslint-disable-next-line react-refresh/only-export-components
export function useDemoOpen() {
  const status = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => getDemoStatus(),
    staleTime: 5 * 60_000,
  });
  return status.data?.enabled === true;
}

type DemoButtonProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  // Shown instead of the button while the public demo is closed; nothing by default.
  closed?: ReactNode;
};

// Signs in to the shared casings demo account (no admin rights) and opens the app.
// Kept independent of the auth context so the button renders anywhere, provider or not.
export function DemoButton({ closed = null, ...props }: DemoButtonProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!useDemoOpen()) return <>{closed}</>;

  return (
    <Button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          const { tokenHash } = await getDemoSignIn();
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "magiclink",
          });
          if (error) throw error;
          navigate({ to: "/app" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't open the demo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      Try the casings demo
    </Button>
  );
}

// Signs in to the accounts-payable demo reviewer and opens Submit document, where the samples are.
// The label defaults to "Try the invoice desk"; the landing page passes "Try the demo".
export function ApDemoButton({
  children = "Try the invoice desk",
  closed = null,
  ...props
}: DemoButtonProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!useDemoOpen()) return <>{closed}</>;

  return (
    <Button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          const { tokenHash } = await getApDemoSignIn();
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "magiclink",
          });
          if (error) throw error;
          navigate({ to: "/app/overview" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't open the invoice desk demo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
