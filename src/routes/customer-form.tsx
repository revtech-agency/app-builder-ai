import { createFileRoute } from "@tanstack/react-router";

import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/customer-form")({
  head: () => ({ meta: [{ title: "Customer details — AppBuilder.ai" }] }),
  component: CustomerFormPage,
});

function CustomerFormPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Your details</CardTitle>
          <CardDescription>Fill in the fields below and we will get back to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
