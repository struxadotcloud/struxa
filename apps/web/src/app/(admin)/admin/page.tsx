"use client";

import { useQuery } from "@tanstack/react-query";
import { Server, Monitor, Activity } from "lucide-react";
import Link from "next/link";
import { orpc } from "@/utils/orpc";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: color ? `${color}18` : undefined }}
        >
          <Icon className="h-4 w-4" style={{ color: color ?? "currentColor" }} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const QUICK_LINKS = [
  { href: "/admin/locations", label: "Manage Locations", description: "Add and configure Wings nodes" },
  { href: "/admin/nodes", label: "Manage Nodes", description: "View and edit your nodes" },
  { href: "/admin/nests", label: "Nests & Eggs", description: "Configure server templates" },
  { href: "/admin/servers/new", label: "Create Server", description: "Provision a new game server" },
];

export default function AdminDashboard() {
  const { data: nodes } = useQuery(orpc.nodes.list.queryOptions());
  const { data: servers } = useQuery(orpc.servers.list.queryOptions());

  const onlineNodes = nodes?.filter((n) => !n.maintenanceMode).length ?? 0;

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-foreground">Dashboard</h1>
        </div>

        <div className="mb-6">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Overview</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={Server}
              label="Nodes"
              value={nodes?.length ?? "—"}
              sub={`${onlineNodes} online`}
              color="#22c55e"
            />
            <StatCard
              icon={Monitor}
              label="Servers"
              value={servers?.length ?? "—"}
              color="#3b82f6"
            />
            <StatCard
              icon={Activity}
              label="Active Nodes"
              value={onlineNodes}
              color="#f59e0b"
            />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Links</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-border/80"
              >
                <span className="text-sm font-medium text-foreground group-hover:text-foreground">{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
