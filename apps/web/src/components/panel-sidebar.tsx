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
} from "lucide-react";
import { mockServers } from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";

const NAV_PRIMARY = [
  { key: "servers", label: "Game Servers", icon: Server },
  { key: "account", label: "Account", icon: User },
  { key: "billing", label: "Billing", icon: CreditCard },
];

const NAV_SECONDARY = [
  { key: "support", label: "Support", icon: LifeBuoy },
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
  const _server = serverId ? mockServers.find((s) => s.id === serverId) : null;
  const activeServerTab = pathname.split("/servers/")[1]?.split("/")[1] ?? "console";

  return (
    <Sidebar collapsible="icon" className="border-r border-[#222222] bg-[#0a0a0a]">
      <SidebarHeader className="flex items-center justify-center border-b border-[#222222] px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logo-white.svg"
            alt="Logo"
            width={96}
            height={28}
            priority
            className="h-6 w-auto"
          />
          {state === "expanded" && <span className="text-sm font-semibold text-white">struxa</span>}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {isServerPage ? (
          <SidebarGroup>
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
                      className="gap-2.5 text-xs"
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
                        isActive={pathname === "/" ? item.key === "servers" : false}
                        className="gap-2.5 text-xs"
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
                      <SidebarMenuButton className="gap-2.5 text-xs">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {user?.role === "admin" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        render={<Link href={"/admin" as never} />}
                        className="gap-2.5 text-xs"
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

      <div className="flex shrink-0 items-center border-t border-[#222222] px-3 py-2.5">
        {state === "expanded" ? (
          <div className="flex w-full items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.name ?? "—"}</p>
              <p className="truncate text-[10px] text-[#555555]">{user?.email ?? ""}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[#555555] transition-colors hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#333333] bg-[#1a1a1a] text-xs font-semibold text-white">
              {initials}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
