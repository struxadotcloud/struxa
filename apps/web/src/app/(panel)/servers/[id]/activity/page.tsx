"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Activity, Power, FileText, HardDrive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function StatRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-b border-[#222222]">
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#555555]">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

type EventStyle = { label: string; color: string; border: string };

function getEventStyle(event: string): EventStyle {
  if (event.startsWith("server:power.start") || event === "server:power.restart")
    return { label: event.split(":")[1] ?? event, color: "text-[#22c55e]", border: "border-[#22c55e]/40" };
  if (event.startsWith("server:power.stop"))
    return { label: "power.stop", color: "text-[#f43f5e]", border: "border-[#f43f5e]/40" };
  if (event.startsWith("server:backup"))
    return { label: event.split(":")[1] ?? event, color: "text-[#a855f7]", border: "border-[#a855f7]/40" };
  if (event.startsWith("server:files"))
    return { label: event.split(":")[1] ?? event, color: "text-[#3b82f6]", border: "border-[#3b82f6]/40" };
  if (event.startsWith("server:console"))
    return { label: "console.command", color: "text-[#f59e0b]", border: "border-[#f59e0b]/40" };
  if (event.startsWith("user:"))
    return { label: event.split(":")[1] ?? event, color: "text-[#888888]", border: "border-[#333333]" };
  return { label: event, color: "text-[#888888]", border: "border-[#333333]" };
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: activityData, isPending: activityPending } = useQuery({
    ...orpc.activity.list.queryOptions({ input: { serverId: serverId ?? "", page: 1 } }),
    enabled: !!serverId,
  });

  if (isPending || !session) return <Loader />;

  const entries = activityData?.data ?? [];
  const powerCount = entries.filter((e) => e.eventType.startsWith("server:power")).length;
  const fileCount = entries.filter((e) => e.eventType.startsWith("server:files")).length;
  const backupCount = entries.filter((e) => e.eventType.startsWith("server:backup")).length;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${id}`} className="text-[#555555] transition-colors hover:text-white">
            {server?.name ?? id}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Activity</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[200px_220px_1fr_140px] border-b border-r border-[#222222] px-3 py-2">
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Timestamp</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Event</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Actor</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">IP Address</span>
            </div>
            {activityPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">No activity yet</div>
            ) : (
              entries.map((entry) => {
                const style = getEventStyle(entry.eventType);
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[200px_220px_1fr_140px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
                  >
                    <span className="font-mono text-xs text-[#444444]">{fmtDate(entry.timestamp)}</span>
                    <span className={`font-mono text-xs border px-1.5 py-0.5 w-fit ${style.color} ${style.border}`}>
                      {style.label}
                    </span>
                    <span className="text-sm text-[#888888] truncate pr-4">
                      {entry.userId ?? "system"}
                    </span>
                    <span className="font-mono text-xs text-[#555555]">{entry.ip ?? "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Activity} label="EVENTS">
            <span className="text-2xl font-bold text-white">{entries.length}</span>
          </StatRow>
          <StatRow icon={Power} label="POWER EVENTS">
            <span className="text-2xl font-bold text-white">{powerCount}</span>
          </StatRow>
          <StatRow icon={FileText} label="FILE WRITES">
            <span className="text-2xl font-bold text-[#3b82f6]">{fileCount}</span>
          </StatRow>
          <StatRow icon={HardDrive} label="BACKUPS">
            <span className="text-2xl font-bold text-[#a855f7]">{backupCount}</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
