import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const demo = vi.hoisted(() => ({ enabled: false }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin")>()),
  getDemoStatus: vi.fn(async () => ({ enabled: demo.enabled })),
  getApDemoSignIn: vi.fn(),
  getDemoSignIn: vi.fn(),
}));
vi.mock("@/components/contact-form", () => ({ ContactForm: () => null }));

import { demoEnabled, isDemoAccount } from "@/lib/admin";
import { Route } from "@/routes/index";

const renderLanding = () => {
  const Page = Route.options.component!;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Page />
    </QueryClientProvider>,
  );
};

describe("DEMO_ENABLED switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off unless set to true", () => {
    vi.stubEnv("DEMO_ENABLED", "");
    expect(demoEnabled()).toBe(false);
    vi.stubEnv("DEMO_ENABLED", "yes");
    expect(demoEnabled()).toBe(false);
    vi.stubEnv("DEMO_ENABLED", "true");
    expect(demoEnabled()).toBe(true);
  });

  it("knows the two shared demo accounts, in any letter case", () => {
    expect(isDemoAccount("demo@appbuilder.ai")).toBe(true);
    expect(isDemoAccount("AP-Demo@AppBuilder.ai")).toBe(true);
    expect(isDemoAccount("daniel@appbuilder.ai")).toBe(false);
    expect(isDemoAccount(undefined)).toBe(false);
  });
});

describe("landing page and the demo switch", () => {
  it("offers 'Book a demo' and no demo sign-in while the demo is closed", async () => {
    demo.enabled = false;
    renderLanding();
    expect((await screen.findAllByRole("link", { name: "Book a demo" })).length).toBe(3);
    expect(screen.queryByRole("button", { name: "Try the demo" })).toBeNull();
    expect(screen.getByText(/The public demo closed after the hackathon/)).toBeTruthy();
  });

  it("shows 'Try the demo' when the demo is switched on", async () => {
    demo.enabled = true;
    renderLanding();
    expect((await screen.findAllByRole("button", { name: "Try the demo" })).length).toBe(3);
    expect(screen.queryByRole("link", { name: "Book a demo" })).toBeNull();
  });
});
