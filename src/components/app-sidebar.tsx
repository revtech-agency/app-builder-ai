import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChartColumn, FilePlus2, LogOut, ReceiptText, ShieldCheck, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { listInvoices } from "@/lib/invoices";

// Active nav item: a square 3px gold marker on the left edge (AppBuilder.ai design system).
const activeMarker =
  "relative data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:bg-sidebar-primary data-[active=true]:before:content-['']";

export function AppSidebar() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();

  // Shares the cache with the invoices page; only used for the "needs review" badge.
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => listInvoices() });
  const needsReview = invoices.data?.filter((i) => i.stage === "needs_review").length ?? 0;

  const nav = [
    { to: "/app/overview", label: "Overview", icon: ChartColumn, badge: 0 },
    { to: "/app/invoices", label: "Invoices", icon: ReceiptText, badge: needsReview },
    { to: "/app/intake", label: "Intake", icon: FilePlus2, badge: 0 },
    { to: "/app/suppliers", label: "Suppliers", icon: Truck, badge: 0 },
  ] as const;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden
          >
            A
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">AppBuilder.ai</span>
            <span className="block truncate text-xs text-sidebar-muted-foreground">
              Accounts payable
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild className={activeMarker}>
                    <Link
                      to={item.to}
                      activeProps={{ "data-active": "true" }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge > 0 && (
                    <SidebarMenuBadge className="rounded-sm bg-sidebar-primary font-mono font-bold text-sidebar-primary-foreground">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={activeMarker}>
                    <Link
                      to="/app/admin"
                      activeProps={{ "data-active": "true" }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <ShieldCheck />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-3">
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-sidebar-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Sign out"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
