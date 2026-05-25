"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@struxa/ui/components/sidebar";
import { PanelSidebar } from "./panel-sidebar";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const SIDEBAR_STORAGE_KEY = "sidebar:open";

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) setOpen(saved === "true");
  }, []);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  }

  if (isAuthRoute) return <>{children}</>;

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange} className="h-svh overflow-hidden">
      <PanelSidebar />
      <SidebarInset className="flex flex-col overflow-hidden bg-background">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2.5 md:hidden">
            <span className="text-sm font-semibold text-foreground">Struxa</span>
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
    </SidebarProvider>
  );
}
