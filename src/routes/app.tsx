import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import headerImage from "@/assets/app-header-fulfillment-robots.jpg";
import { AppSidebar } from "@/components/app-sidebar";
import { DemoGuide } from "@/components/demo-guide";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "AppBuilder.ai" }] }),
  component: AppLayout,
});

function AppLayout() {
  const { user, ready, isDemo } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Invoice desk pages, where the demo account gets the step-by-step guide.
  const deskPage = /^\/app\/(overview|invoices|purchase-orders|suppliers|rules)(\/|$)/.test(
    pathname,
  );

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
          {/* Like the sidebar logo: /app sends each user to their start page (the overview for the invoice desk). */}
          <Link to="/app" className="text-sm font-semibold">
            AppBuilder.ai
          </Link>
        </header>
        <img
          src={headerImage}
          alt=""
          width={1619}
          height={971}
          className="h-32 w-full border-b object-cover object-[center_55%] md:h-44"
        />
        {isDemo && deskPage && <DemoGuide />}
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
