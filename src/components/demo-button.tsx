import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// Signs in to the shared demo account (no admin rights) and opens the app.
export function DemoButton(props: Omit<ComponentProps<typeof Button>, "onClick">) {
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
          toast.error(err instanceof Error ? err.message : "Couldn't open the demo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      Try the demo
    </Button>
  );
}
