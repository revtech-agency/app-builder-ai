import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ComponentProps } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getApDemoAvailable } from "@/lib/admin";
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

// Signs in to the accounts-payable demo reviewer and opens the invoice desk.
// Hidden unless the demo account is configured on the server.
export function ApDemoButton(props: Omit<ComponentProps<typeof Button>, "onClick">) {
  const { signInApDemo } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const available = useQuery({
    queryKey: ["ap-demo-available"],
    queryFn: () => getApDemoAvailable(),
  });
  if (!available.data?.available) return null;

  return (
    <Button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await signInApDemo();
          navigate({ to: "/app/invoices" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't open the invoice desk demo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      Try the invoice desk
    </Button>
  );
}
