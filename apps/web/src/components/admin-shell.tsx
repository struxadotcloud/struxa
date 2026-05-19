"use client";

import { useState, useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@struxa/ui/components/sidebar";
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
          <SidebarInset className="flex flex-col overflow-hidden bg-[#0a0a0a]">
            {children}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </ThemeProvider>
  );
}
