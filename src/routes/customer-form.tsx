import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/customer-form")({
  head: () => ({ meta: [{ title: "Customer details — AppBuilder.ai" }] }),
  component: CustomerFormPage,
});

const CustomerDetails = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  surname: z.string().trim().min(1, "Enter your surname."),
  company: z.string().trim().min(1, "Enter your company."),
  email: z.string().trim().email("Enter a valid email address."),
});

type CustomerDetails = z.infer<typeof CustomerDetails>;
type Errors = Partial<Record<keyof CustomerDetails, string>>;

const FIELDS: { key: keyof CustomerDetails; label: string; type?: string; autoComplete: string }[] =
  [
    { key: "name", label: "Name", autoComplete: "given-name" },
    { key: "surname", label: "Surname", autoComplete: "family-name" },
    { key: "company", label: "Company", autoComplete: "organization" },
    { key: "email", label: "Email", type: "email", autoComplete: "email" },
  ];

const EMPTY: CustomerDetails = { name: "", surname: "", company: "", email: "" };

function CustomerFormPage() {
  const [form, setForm] = useState<CustomerDetails>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
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
    // TODO: send result.data to the backend (n8n webhook / HubSpot) once it is chosen.
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        {submitted ? (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <h1 className="text-xl font-semibold">Thank you, {form.name}</h1>
            <p className="text-sm text-muted-foreground">
              We have your details and will be in touch at {form.email}.
            </p>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Your details</CardTitle>
              <CardDescription>Fill in the fields below and we will get back to you.</CardDescription>
            </CardHeader>
            <CardContent>
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
                <Button type="submit" className="w-full">
                  Submit
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
