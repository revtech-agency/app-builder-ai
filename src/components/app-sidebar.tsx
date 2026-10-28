import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChartColumn,
  ChevronsUpDown,
  ClipboardList,
  Building2,
  FileInput,
  History,
  Inbox,
  LogOut,
  MessageSquarePlus,
  Package,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const navigate = useNavigate();
  const { user, isAdmin, canUseInvoiceDesk, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();

  const companies = useQuery({ queryKey: ["my-companies"], queryFn: () => getMyCompanies() });
  const cartCount = useCartCount(companyId);

  const company = companies.data?.find((c) => c.id === companyId);
  const hasCompanies = (companies.data?.length ?? 0) > 0;
  const deskNav = [
    { to: "/app/invoices", label: "Queue", icon: Inbox },
    { to: "/app/invoices/new", label: "Submit document", icon: FileInput },
    { to: "/app/suppliers", label: "Suppliers", icon: Building2 },
    { to: "/app/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  ] as const;
  const canSwitch = isAdmin && (companies.data?.length ?? 0) > 1;

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

  const companyLabel = (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
        {company?.name.charAt(0) ?? "?"}
      </span>
      <span className="truncate text-sm font-semibold">{company?.name ?? "Select company"}</span>
    </span>
  );

  return (
    <Sidebar>
      {hasCompanies && (
      <SidebarHeader>
        {canSwitch ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-auto w-full justify-between border-sidebar-border bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                {companyLabel}
                <ChevronsUpDown className="size-4 shrink-0 text-sidebar-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
              {companies.data?.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onSelect={() => {
                    setOpenMobile(false);
                    navigate({ to: "/app/$companyId/orders", params: { companyId: c.id } });
                  }}
                >
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground">
            {companyLabel}
          </div>
        )}
      </SidebarHeader>
      )}

      <SidebarContent>
        {hasCompanies && (
        <SidebarGroup>
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
                    <SidebarMenuButton asChild className={activeMarker}>
                      <Link
                        to={item.to}
                        activeOptions={{ exact: item.to !== "/app/invoices" }}
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
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={activeMarker}>
                    <Link
                      to="/app/dashboard"
                      activeProps={{ "data-active": "true" }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <ChartColumn />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={activeMarker}>
                    <Link
                      to="/app/admin-old"
                      activeProps={{ "data-active": "true" }}
                      onClick={() => setOpenMobile(false)}
                    >
                      <History />
                      <span>Admin (old)</span>
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
