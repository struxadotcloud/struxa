"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@struxa/ui/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import {
  Server,
  User,
  Settings,
  Terminal,
  FolderOpen,
  Database,
  Clock,
  Users,
  Archive,
  Globe,
  Activity,
  LogOut,
  ShieldCheck,
  ChevronLeft,
  Wallet,
  ShoppingBag,
  Package,
  Box,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function PanelSidebar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const { state } = useSidebar();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const initials = user?.name ? user.name[0]!.toUpperCase() : "?";
  const avatarImage = user?.image ?? null;

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const isServerPage = pathname.startsWith("/servers/");
  const serverId = isServerPage ? (params.id as string) : null;
  const activeServerTab = pathname.split("/servers/")[1]?.split("/")[1] ?? "console";

  const { data: billingConfig } = useQuery(orpc.billing.getConfig.queryOptions());
  const { data: wallet } = useQuery({
    ...orpc.billing.getWallet.queryOptions(),
    enabled: !!billingConfig?.enabled,
  });

  const { data: serverFeatures } = useQuery({
    ...orpc.servers.get.queryOptions({ input: { id: serverId ?? "" } }),
    enabled: !!serverId,
    select: (s) => {
      try {
        const parsed: unknown = JSON.parse(s.egg?.features ?? "[]");
        return Array.isArray(parsed) && parsed.every((f) => typeof f === "string") ? parsed : [];
      } catch { return [] as string[]; }
    },
  });

  function formatBalance(cents: number, currency: string) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  }

  const NAV_PRIMARY = [
    { key: "servers", label: t("panel.gameServers"), icon: Server, href: "/" },
    ...(billingConfig?.enabled ? [
      { key: "wallet", label: t("panel.wallet"), icon: Wallet, href: "/billing/wallet" },
      { key: "shop", label: t("panel.shop"), icon: ShoppingBag, href: "/billing" },
    ] : []),
    { key: "account", label: t("panel.account"), icon: User, href: "/account" },
  ];

  const hasPlugins = serverFeatures?.includes("minecraft_plugins") ?? false;
  const hasMods = serverFeatures?.includes("minecraft_mods") ?? false;

  const NAV_SERVER = [
    { key: "console", label: t("server.console"), icon: Terminal },
    { key: "files", label: t("server.files"), icon: FolderOpen },
    ...(hasPlugins ? [{ key: "plugins", label: t("server.plugins"), icon: Package }] : []),
    ...(hasMods ? [{ key: "mods", label: t("server.mods"), icon: Box }] : []),
    { key: "databases", label: t("server.databases"), icon: Database },
    { key: "schedules", label: t("server.schedules"), icon: Clock },
    { key: "users", label: t("server.users"), icon: Users },
    { key: "backups", label: t("server.backups"), icon: Archive },
    { key: "network", label: t("server.network"), icon: Globe },
    { key: "settings", label: t("server.settings"), icon: Settings },
    { key: "activity", label: t("server.activity"), icon: Activity },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-0">
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-foreground transition-colors hover:bg-sidebar-accent overflow-hidden">
              {avatarImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarImage} alt={user?.name ?? "avatar"} className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                initials
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
              {user?.role === "admin" && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin" as never)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {tc("adminPanel")}
                </DropdownMenuItem>
              )}
              {user?.role === "admin" && <DropdownMenuSeparator className="my-1 border-border" />}
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                {tc("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="group-data-[collapsible=icon]:hidden px-2 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground overflow-hidden">
                {avatarImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarImage} alt={user?.name ?? "avatar"} className="h-6 w-6 rounded-md object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
              </div>
              {billingConfig?.enabled && wallet && (
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground bg-muted rounded px-1.5 py-0.5 leading-none">
                  {formatBalance(wallet.balanceCents, wallet.currency)}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
              {user?.role === "admin" && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin" as never)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {tc("adminPanel")}
                </DropdownMenuItem>
              )}
              {user?.role === "admin" && <DropdownMenuSeparator className="my-1 border-border" />}
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                {tc("signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        {isServerPage ? (
          <SidebarGroup className="p-0">
            {state === "expanded" && (
              <Link
                href="/"
                className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                {t("panel.allServers")}
              </Link>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_SERVER.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={
                            item.key === "console"
                              ? (`/servers/${serverId}` as never)
                              : (`/servers/${serverId}/${item.key}` as never)
                          }
                        />
                      }
                      isActive={item.key === activeServerTab}
                      tooltip={item.label}
                      className="h-auto gap-2 rounded-lg py-2 px-3 text-sm transition-colors duration-150"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_PRIMARY.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={item.href as never} />}
                        isActive={
                          item.key === "servers" ? pathname === "/" :
                          item.key === "shop" ? (pathname === "/billing" || (pathname.startsWith("/billing/") && !pathname.startsWith("/billing/wallet"))) :
                          pathname.startsWith(item.href)
                        }
                        tooltip={item.label}
                        className="h-auto gap-2 rounded-lg py-2 px-3 text-sm transition-colors duration-150"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

          </>
        )}
      </SidebarContent>

      <div className="border-t border-sidebar-border">
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </div>
        <div className="group-data-[collapsible=icon]:hidden flex items-center gap-2 px-4 py-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground/50">© {new Date().getFullYear()} Struxa</p>
            <p className="text-[10px] text-muted-foreground/40">
              {process.env.NODE_ENV === "development"
                ? "in-dev"
                : [process.env.NEXT_PUBLIC_APP_VERSION, process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
