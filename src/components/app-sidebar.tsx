import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  Coins,
  Inbox,
  LogOut,
  MessageSquare,
  Rocket,
  Sparkles,
  TrendingUp,
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getCompanies, listAsks, listDrafts } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AppSidebar() {
  const { companyId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();

  const companies = useQuery({ queryKey: ["companies"], queryFn: getCompanies });
  const asks = useQuery({
    queryKey: ["asks", companyId],
    queryFn: () => listAsks(companyId!),
    enabled: !!companyId,
  });
  const drafts = useQuery({
    queryKey: ["drafts", companyId],
    queryFn: () => listDrafts(companyId!),
    enabled: !!companyId,
  });

  const company = companies.data?.find((c) => c.id === companyId);
  const needsYou =
    (asks.data?.filter((a) => a.status === "open").length ?? 0) +
    (drafts.data?.filter((d) => d.status === "draft").length ?? 0);

  const nav = [
    { to: "/app/$companyId/chat", label: "Chat", icon: MessageSquare, badge: 0 },
    { to: "/app/$companyId/growth", label: "Growth", icon: TrendingUp, badge: 0 },
    { to: "/app/$companyId/inbox", label: "Inbox", icon: Inbox, badge: needsYou },
    { to: "/app/$companyId/deploys", label: "Deploys", icon: Rocket, badge: 0 },
    { to: "/app/$companyId/sales-analysis", label: "Sales analysis", icon: Sparkles, badge: 0 },
  ] as const;

  return (
    <Sidebar>
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-auto w-full justify-between bg-card px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {company?.name.charAt(0) ?? "?"}
                </span>
                <span className="truncate text-sm font-semibold">
                  {company?.name ?? "Select company"}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
            {companies.data?.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => {
                  setOpenMobile(false);
                  navigate({ to: "/app/$companyId/chat", params: { companyId: c.id } });
                }}
              >
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {companyId &&
                nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild>
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
                    {item.badge > 0 && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3">
        <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm">
          <Coins className="size-4 text-primary" />
          <span className="text-muted-foreground">Credits</span>
          <span className="ml-auto font-semibold">{company?.credits_balance ?? "–"}</span>
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
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
