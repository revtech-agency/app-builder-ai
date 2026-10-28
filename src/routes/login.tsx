import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { DemoButton } from "@/components/demo-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — AppBuilder.ai" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  const isSignUp = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {isSignUp ? "Create your account" : "Sign in to AppBuilder.ai"}
          </CardTitle>
          <CardDescription>
            {isSignUp ? "Start building your company." : "Welcome back."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              setNotice(null);
              try {
                if (isSignUp) {
                  const needsConfirm = await signUp(email, password, name);
                  if (needsConfirm) setNotice("Check your email to confirm your account.");
                } else {
                  await signIn(email, password);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>
          {!isSignUp && <DemoButton variant="outline" className="mt-3 w-full" />}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "New to AppBuilder.ai?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setMode(isSignUp ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
