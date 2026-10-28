import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// "AppBuilder.ai – Contact us" form in HubSpot portal 149650024. Both ids are public:
// HubSpot's form-submit endpoint takes no key and allows browser calls (CORS).
const HUBSPOT_PORTAL_ID = "149650024";
const HUBSPOT_FORM_ID = "da6f5e44-b92d-4ac3-8663-615af39ad3bd";

const CustomerDetails = z.object({
  firstname: z.string().trim().min(1, "Enter your name."),
  lastname: z.string().trim().min(1, "Enter your surname."),
  company: z.string().trim().min(1, "Enter your company."),
  email: z.string().trim().email("Enter a valid email address."),
});

type CustomerDetails = z.infer<typeof CustomerDetails>;
type Errors = Partial<Record<keyof CustomerDetails, string>>;

const FIELDS: { key: keyof CustomerDetails; label: string; type?: string; autoComplete: string }[] =
  [
    { key: "firstname", label: "Name", autoComplete: "given-name" },
    { key: "lastname", label: "Surname", autoComplete: "family-name" },
    { key: "company", label: "Company", autoComplete: "organization" },
    { key: "email", label: "Email", type: "email", autoComplete: "email" },
  ];

const EMPTY: CustomerDetails = { firstname: "", lastname: "", company: "", email: "" };

async function submitToHubSpot(data: CustomerDetails) {
  const res = await fetch(
    `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: Object.entries(data).map(([name, value]) => ({ objectTypeId: "0-1", name, value })),
        context: { pageUri: window.location.href, pageName: document.title },
      }),
    },
  );
  if (!res.ok) throw new Error("submit failed");
}

export function ContactForm() {
  const [form, setForm] = useState<CustomerDetails>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const submit = async () => {
    const result = CustomerDetails.safeParse(form);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CustomerDetails;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      await submitToHubSpot(result.data);
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <p className="text-lg font-semibold">Thank you, {form.firstname}</p>
        <p className="text-sm text-muted-foreground">
          We have your details and will be in touch at {form.email}.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-2">
          <Label htmlFor={f.key}>{f.label}</Label>
          <Input
            id={f.key}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            value={form[f.key]}
            aria-invalid={!!errors[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
          />
          {errors[f.key] && <p className="text-sm text-destructive">{errors[f.key]}</p>}
        </div>
      ))}
      {status === "failed" && (
        <p className="text-sm text-destructive">
          Something went wrong sending your details. Please try again or email daniel@appbuilder.ai.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={status === "sending"}>
        {status === "sending" && <Loader2 className="size-4 animate-spin" />}
        Submit
      </Button>
    </form>
  );
}
