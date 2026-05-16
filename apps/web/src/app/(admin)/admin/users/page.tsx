"use client";

import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Users } from "lucide-react";

export default function AdminUsersPage() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#222222] px-4">
        <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
        <Users className="h-4 w-4 text-[#555555]" />
        <span className="text-sm text-white">Users</span>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 border-l border-t border-[#222222]">
          <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
            User management is handled through Better Auth. Use the Better Auth admin panel or API to manage users.
          </div>
        </div>
      </div>
    </>
  );
}
