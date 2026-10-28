import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import headerImage from "@/assets/app-header-fulfillment-robots.jpg";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "AppBuilder.ai" }] }),
  component: AppLayout,
});

// Local preview without a login: only in a dev build (never in production) with
// VITE_DEV_PREVIEW=1. The server side has its own switch (INVOICE_PREVIEW_NO_LOGIN, mock data only).
const devPreview = import.meta.env.DEV && import.meta.env["VITE_DEV_PREVIEW"] === "1";

function AppLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  // Client-side guard: auth state only exists in the browser, so SSR renders nothing here.
  useEffect(() => {
    if (!devPreview && ready && !user) navigate({ to: "/login", replace: true });
  }, [ready, user, navigate]);

  if (!devPreview && (!ready || !user)) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-semibold">AppBuilder.ai</span>
        </header>
        <img
          src={headerImage}
          alt=""
          width={1619}
          height={971}
          className="h-32 w-full border-b object-cover object-[center_55%] md:h-44"
        />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
