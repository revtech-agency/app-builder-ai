import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Sends leads to a HubSpot form through the public Forms API v3 (no token needed).
// Create the form in the sales portal (not the order-worker demo portal) with the
// fields firstname, email, company, message, then set these two variables.
const PORTAL_ID = import.meta.env.VITE_HUBSPOT_PORTAL_ID as string | undefined;
const FORM_GUID = import.meta.env.VITE_HUBSPOT_FORM_GUID as string | undefined;

const CONSENT_TEXT =
  "I agree to AppBuilder.ai processing my details to reply to this request.";

type State = "idle" | "sending" | "done" | "error";

export function ContactForm() {
  const [state, setState] = useState<State>("idle");
  const [consent, setConsent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!PORTAL_ID || !FORM_GUID) {
      setState("error");
      return;
    }
    const form = new FormData(e.currentTarget);
    const hutk = document.cookie.match(/(?:^|; )hubspotutk=([^;]+)/)?.[1];
    setState("sending");
    try {
      const res = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: ["firstname", "email", "company", "message"].map((name) => ({
              name,
              value: String(form.get(name) ?? ""),
            })),
            context: {
              pageUri: window.location.href,
              pageName: document.title,
              ...(hutk ? { hutk } : {}),
            },
            legalConsentOptions: {
              consent: { consentToProcess: true, text: CONSENT_TEXT },
            },
          }),
        },
      );
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="text-primary-foreground">
        Thanks. We'll reply within one business day.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="firstname" placeholder="Name" autoComplete="name" required className="bg-background text-foreground" />
        <Input name="company" placeholder="Company" autoComplete="organization" required className="bg-background text-foreground" />
      </div>
      <Input name="email" type="email" placeholder="Work email" autoComplete="email" required className="bg-background text-foreground" />
      <Textarea name="message" rows={3} placeholder="Which flow eats your team's week?" className="bg-background text-foreground" />
      <label className="flex items-start gap-2 text-sm text-primary-foreground/80">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5 border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
        />
        <span>
          {CONSENT_TEXT}{" "}
          <a href="/privacy" className="underline">
            Privacy policy
          </a>
        </span>
      </label>
      <Button type="submit" variant="secondary" size="lg" disabled={!consent || state === "sending"}>
        {state === "sending" && <Loader2 className="size-4 animate-spin" />}
        Talk to us
      </Button>
      {state === "error" && (
        <p className="text-sm text-primary-foreground">
          That didn't go through. Email{" "}
          <a href="mailto:daniel@appbuilder.ai" className="underline">
            daniel@appbuilder.ai
          </a>{" "}
          instead.
        </p>
      )}
    </form>
  );
}
