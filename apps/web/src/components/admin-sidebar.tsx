"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

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
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const initials = user?.name ? user.name[0]!.toUpperCase() : "?";

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

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
