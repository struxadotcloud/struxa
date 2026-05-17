"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  LayoutDashboard,
  MapPin,
  Server,
  Package,
  Database,
  Monitor,
  Users,
  Settings2,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { key: "locations", label: "Locations", icon: MapPin, href: "/admin/locations" },
  { key: "nodes", label: "Nodes", icon: Server, href: "/admin/nodes" },
  { key: "nests", label: "Nests & Eggs", icon: Package, href: "/admin/nests" },
  { key: "database-hosts", label: "Database Hosts", icon: Database, href: "/admin/database-hosts" },
  { key: "servers", label: "Servers", icon: Monitor, href: "/admin/servers" },
  { key: "users", label: "Users", icon: Users, href: "/admin/users" },
  { key: "settings", label: "Settings", icon: Settings2, href: "/admin/settings" },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

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
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">struxa</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">admin</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    render={<Link href={item.href as never} />}
                    isActive={isActive(item.href)}
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
      </SidebarContent>

      <div className="flex h-11 shrink-0 items-center gap-2 border-t border-[#222222] px-4">
        <Link href="/" className="text-[10px] text-[#444444] hover:text-[#888888] transition-colors">
          ← Back to panel
        </Link>
      </div>
    </Sidebar>
  );
}
