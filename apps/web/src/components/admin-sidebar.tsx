"use client";

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
  SidebarTrigger,
} from "@struxa/ui/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
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
  ChevronLeft,
} from "lucide-react";
import Image from "next/image";
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
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const initials = user?.name ? user.name[0]!.toUpperCase() : "?";
  const avatarImage = user?.image ?? null;

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
      <SidebarHeader className="p-0">
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground transition-colors hover:bg-sidebar-accent overflow-hidden">
              {avatarImage ? (
                <Image src={avatarImage} alt={user?.name ?? "avatar"} width={32} height={32} className="h-8 w-8 object-cover" />
              ) : initials}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
              <DropdownMenuItem
                onClick={() => router.push("/" as never)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Panel
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="group-data-[collapsible=icon]:hidden px-2 py-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground overflow-hidden">
                {avatarImage ? (
                  <Image src={avatarImage} alt={user?.name ?? "avatar"} width={24} height={24} className="h-6 w-6 object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
              <DropdownMenuItem
                onClick={() => router.push("/" as never)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Panel
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    render={<Link href={item.href as never} />}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="h-auto gap-2 rounded-lg py-2 px-3 text-sm"
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
