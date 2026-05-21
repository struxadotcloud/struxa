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
  const avatarImage = user?.image ?? null;

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  const isServerPage = pathname.startsWith("/servers/");
  const serverId = isServerPage ? (params.id as string) : null;
  const activeServerTab = pathname.split("/servers/")[1]?.split("/")[1] ?? "console";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-0">
        <div className="hidden group-data-[collapsible=icon]:flex justify-center py-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-foreground transition-colors hover:bg-sidebar-accent overflow-hidden">
              {avatarImage ? (
                <Image src={avatarImage} alt={user?.name ?? "avatar"} width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
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
                  Admin Panel
                </DropdownMenuItem>
              )}
              {user?.role === "admin" && <DropdownMenuSeparator className="my-1 border-border" />}
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
                  <Image src={avatarImage} alt={user?.name ?? "avatar"} width={24} height={24} className="h-6 w-6 rounded-md object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
              {user?.role === "admin" && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin" as never)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              {user?.role === "admin" && <DropdownMenuSeparator className="my-1 border-border" />}
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
        {isServerPage ? (
          <SidebarGroup className="p-0">
            {state === "expanded" && (
              <Link
                href="/"
                className="mb-1 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
        ) : (
          <>
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_PRIMARY.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={item.href as never} />}
                        isActive={pathname === "/" ? item.key === "servers" : pathname.startsWith(item.href) && item.href !== "/"}
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

            <SidebarGroup className="mt-auto p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_SECONDARY.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        render={<Link href={item.href as never} />}
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
