"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Server, Monitor, Activity } from "lucide-react";
import Link from "next/link";
import { orpc } from "@/utils/orpc";
import { FleetResources } from "./_components/fleet-resources";
import { StatCard } from "./_components/stat-card";

export default function AdminDashboard() {
  const t = useTranslations("admin.dashboard");
  const { data: nodes } = useQuery(orpc.nodes.list.queryOptions());
  const { data: servers } = useQuery(orpc.servers.list.queryOptions());

  const onlineNodes = nodes?.filter((n) => !n.maintenanceMode).length ?? 0;

  const QUICK_LINKS = [
    { href: "/admin/locations", label: t("manageLocations"), description: t("manageLocationsDesc") },
    { href: "/admin/nodes", label: t("manageNodes"), description: t("manageNodesDesc") },
    { href: "/admin/nests", label: t("nestsAndEggs"), description: t("nestsAndEggsDesc") },
    { href: "/admin/servers/new", label: t("createServer"), description: t("createServerDesc") },
  ];

  return (
    <div className="flex-1 overflow-auto px-4 py-5 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
        </div>

        <div className="mb-6">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("overview")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Server}
              label={t("nodesLabel")}
              value={nodes?.length ?? "—"}
              sub={t("nodesOnline", { count: onlineNodes })}
              color="#22c55e"
            />
            <StatCard
              icon={Monitor}
              label={t("serversLabel")}
              value={servers?.length ?? "—"}
              color="#3b82f6"
            />
            <StatCard
              icon={Activity}
              label={t("activeNodesLabel")}
              value={onlineNodes}
              color="#f59e0b"
            />
          </div>
        </div>

        {nodes && servers && <FleetResources nodes={nodes} servers={servers} />}

        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("quickLinks")}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
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
