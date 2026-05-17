"use client";

import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Monitor } from "lucide-react";
import { orpc } from "@/utils/orpc";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-r border-b border-[#222222] p-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#555555]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white">{value}</span>
        {sub && <span className="text-sm text-[#555555]">{sub}</span>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: nodes } = useQuery(orpc.nodes.list.queryOptions());
  const { data: servers } = useQuery(orpc.servers.list.queryOptions());

  const onlineNodes = nodes?.filter((n) => !n.maintenanceMode).length ?? 0;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#222222] px-4">
        <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
        <span className="text-sm text-white">Admin Dashboard</span>
        <span className="border border-[#f59e0b]/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#f59e0b]">
          admin
        </span>
      </header>

      <div className="flex-1 overflow-auto p-0">
        <div className="grid grid-cols-3 border-l border-[#222222]">
          <StatCard
            icon={Server}
            label="Nodes"
            value={nodes?.length ?? "—"}
            sub={`${onlineNodes} online`}
          />
          <StatCard
            icon={Monitor}
            label="Servers"
            value={servers?.length ?? "—"}
          />
          <StatCard
            icon={Server}
            label="Active Nodes"
            value={onlineNodes}
          />
        </div>

        <div className="mt-8 px-6">
          <p className="text-xs uppercase tracking-widest text-[#444444]">Quick links</p>
          <div className="mt-3 grid grid-cols-4 border-l border-t border-[#222222]">
            {[
              { href: "/admin/locations", label: "Manage Locations" },
              { href: "/admin/nodes", label: "Manage Nodes" },
              { href: "/admin/nests", label: "Manage Nests & Eggs" },
              { href: "/admin/servers/new", label: "Create Server" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center border-r border-b border-[#222222] px-4 py-3 text-sm text-[#888888] transition-colors hover:bg-[#111111] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
