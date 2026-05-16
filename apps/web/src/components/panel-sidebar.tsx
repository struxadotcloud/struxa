"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
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
} from "lucide-react";
import { mockServers } from "@/lib/mock-data";

const NAV_PRIMARY = [
  { key: "servers", label: "Game Servers", icon: Server },
  { key: "account", label: "Account", icon: User },
  { key: "billing", label: "Billing", icon: CreditCard },
];

const NAV_SECONDARY = [
  { key: "support", label: "Support", icon: LifeBuoy },
  { key: "settings", label: "Settings", icon: Settings },
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <div className="flex h-11 shrink-0 items-center border-t border-[#222222] px-4">
        <p className="text-[10px] text-[#444444]">$0.00 balance</p>
      </div>
    </Sidebar>
  );
}
