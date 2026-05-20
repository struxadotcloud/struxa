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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <Image src="/logo-dark.svg" alt="Struxa" width={80} height={24} priority className="h-5 w-auto dark:hidden" />
          <Image src="/logo-white.svg" alt="Struxa" width={80} height={24} priority className="hidden h-5 w-auto dark:block" />
          {state === "expanded" && (
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">admin</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    render={<Link href={item.href as never} />}
                    isActive={isActive(item.href)}
                    className="gap-2.5 rounded-lg py-2 text-sm"
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

      <div className="flex shrink-0 items-center border-t border-sidebar-border px-3 py-3">
        {state === "expanded" ? (
          <div className="flex w-full items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {initials}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
