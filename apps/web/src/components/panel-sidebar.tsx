"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@struxa/ui/components/sidebar";
import {
  Server,
  User,
  Settings,
  CreditCard,
  LifeBuoy,
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
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const NAV_PRIMARY = [
  { key: "servers", label: "Game Servers", icon: Server, href: "/" },
  { key: "account", label: "Account", icon: User, href: "/account" },
  { key: "billing", label: "Billing", icon: CreditCard, href: "/billing" },
];

const NAV_SECONDARY = [
  { key: "support", label: "Support", icon: LifeBuoy, href: "/support" },
];

const NAV_SERVER = [
  { key: "console", label: "Console", icon: Terminal },
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "databases", label: "Databases", icon: Database },
  { key: "schedules", label: "Schedules", icon: Clock },
  { key: "users", label: "Users", icon: Users },
  { key: "backups", label: "Backups", icon: Archive },
  { key: "network", label: "Network", icon: Globe },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "activity", label: "Activity", icon: Activity },
];

export function PanelSidebar() {
  const { state } = useSidebar();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const initials = user?.name ? user.name[0]!.toUpperCase() : "?";

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const isServerPage = pathname.startsWith("/servers/");
  const serverId = isServerPage ? (params.id as string) : null;
  const activeServerTab = pathname.split("/servers/")[1]?.split("/")[1] ?? "console";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <Image src="/logo-dark.svg" alt="Struxa" width={80} height={24} priority className="h-5 w-auto dark:hidden" />
          <Image src="/logo-white.svg" alt="Struxa" width={80} height={24} priority className="hidden h-5 w-auto dark:block" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {isServerPage ? (
          <SidebarGroup>
            {state === "expanded" && (
              <Link
                href="/"
                className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" />
                All Servers
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
                      className="gap-2.5 rounded-lg text-sm"
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
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_PRIMARY.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={item.href as never} />}
                        isActive={pathname === "/" ? item.key === "servers" : pathname.startsWith(item.href) && item.href !== "/"}
                        className="gap-2.5 rounded-lg text-sm"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_SECONDARY.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={item.href as never} />}
                        className="gap-2.5 rounded-lg text-sm"
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {user?.role === "admin" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link href={"/admin" as never} />}
                        className="gap-2.5 rounded-lg text-sm"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin Dashboard
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <div className="flex shrink-0 items-center border-t border-sidebar-border px-3 py-3">
        {state === "expanded" ? (
          <div className="flex w-full items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {initials}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
