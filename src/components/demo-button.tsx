import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Signs in to the shared demo account (no admin rights) and opens the app.
export function DemoButton({
  children = "Try the demo",
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick">) {
  const { signInDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await signInDemo();
          navigate({ to: "/app" });
        } catch (err) {
          // Keep server details (table names, Supabase errors) out of the visitor's view.
          console.error("Demo sign-in failed", err);
          toast.error("The demo is unavailable right now. Please try again in a minute.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
      {!busy && <ArrowRight className="size-4" />}
    </Button>
  );
}
