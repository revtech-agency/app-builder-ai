import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChartColumn,
  ClipboardList,
  Building2,
  FileInput,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquarePlus,
  Package,
  Scale,
  ReceiptText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

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
import { useCartCount } from "@/lib/cart";
import { getMyCompanies } from "@/lib/orders";

// Active nav item: a square 3px gold marker on the left edge (AppBuilder.ai design system).
const activeMarker =
  "relative data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:bg-sidebar-primary data-[active=true]:before:content-['']";

export function AppSidebar() {
  const { companyId } = useParams({ strict: false });
  const { pathname } = useLocation();
  // Queue stays highlighted on an invoice page, but not on Submit document (/app/invoices/new).
  const deskActive = (to: string) =>
    to === "/app/invoices"
      ? pathname === to || (pathname.startsWith(`${to}/`) && pathname !== "/app/invoices/new")
      : pathname === to;
  const navigate = useNavigate();
  const { user, isAdmin, canUseInvoiceDesk, canManageDesk, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();

  const companies = useQuery({ queryKey: ["my-companies"], queryFn: () => getMyCompanies() });
  const cartCount = useCartCount(companyId);

  const hasCompanies = (companies.data?.length ?? 0) > 0;
  const deskNav = [
    { to: "/app/overview", label: "Overview", icon: LayoutDashboard },
    { to: "/app/invoices/new", label: "Submit document", icon: FileInput },
    { to: "/app/invoices", label: "Queue", icon: Inbox },
    { to: "/app/efactura", label: "e-Factura intake", icon: Landmark },
    { to: "/app/intake", label: "Email intake", icon: Mail },
    { to: "/app/purchase-orders", label: "Purchase orders", icon: ClipboardList },
    { to: "/app/suppliers", label: "Suppliers", icon: Building2 },
    { to: "/app/rules", label: "Approval rules", icon: Scale },
    ...(canManageDesk ? [{ to: "/app/team", label: "Team", icon: Users } as const] : []),
  ] as const;
  const platformNav = [
    { to: "/app/platform/dashboard", label: "Dashboard", icon: ChartColumn },
    { to: "/app/platform/clients", label: "Client portals", icon: Store },
    { to: "/app/platform/users", label: "Users & roles", icon: ShieldCheck },
  ] as const;

  const nav = [
    { to: "/app/$companyId/orders", label: "Orders", icon: ReceiptText, badge: 0 },
    {
      to: "/app/$companyId/new-order",
      label: "New order",
      icon: MessageSquarePlus,
      badge: cartCount,
    },
    { to: "/app/$companyId/inventory", label: "Inventory", icon: Package, badge: 0 },
  ] as const;

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          to="/app"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold"
          onClick={() => setOpenMobile(false)}
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sm text-sidebar-primary-foreground">
            A
          </span>
          AppBuilder.ai
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {hasCompanies && companyId && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {companies.data?.find((c) => c.id === companyId)?.name ?? "Client portal"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {companyId &&
                  nav.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild className={activeMarker}>
                        <Link
                          to={item.to}
                          params={{ companyId }}
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
        )}
        {canUseInvoiceDesk && (
          <SidebarGroup>
            <SidebarGroupLabel>Invoice desk</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {deskNav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={deskActive(item.to)}
                      className={activeMarker}
                    >
                      <Link to={item.to} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>AppBuilder.ai platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {platformNav.map((item) => (
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
                  </SidebarMenuItem>
                ))}
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
