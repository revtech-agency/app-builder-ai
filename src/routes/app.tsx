import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "AppBuilder.ai" }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();

  // Client-side guard: auth state only exists in the browser, so SSR renders nothing here.
  useEffect(() => {
    if (ready && !user) navigate({ to: "/login", replace: true });
  }, [ready, user, navigate]);

  if (!ready || !user) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-semibold">AppBuilder.ai</span>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
