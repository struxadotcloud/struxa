"use client";

import { useState, useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@struxa/ui/components/sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { ThemeProvider } from "./theme-provider";

const SIDEBAR_STORAGE_KEY = "sidebar:open";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) setOpen(saved === "true");
  }, []);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
  }

  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      <div className="h-svh overflow-hidden">
        <SidebarProvider open={open} onOpenChange={handleOpenChange} className="h-svh overflow-hidden">
          <AdminSidebar />
          <SidebarInset className="flex flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2.5 md:hidden">
              <span className="text-sm font-semibold text-foreground">Struxa Admin</span>
              <SidebarTrigger />
            </div>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </ThemeProvider>
  );
}
