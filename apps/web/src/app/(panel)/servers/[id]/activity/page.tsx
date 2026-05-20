"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Activity, Power, FileText, HardDrive, ChevronRight } from "lucide-react";
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
    <div className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex flex-col gap-1.5 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

const EVENT_STYLES: Record<string, { color: string; bg: string }> = {
  "server:power.start":   { color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  "server:power.restart": { color: "#22c55e", bg: "rgba(34,197,94,0.12)"  },
  "server:power.stop":    { color: "#f43f5e", bg: "rgba(244,63,94,0.12)"  },
  backup:                 { color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  files:                  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  console:                { color: "#71717a", bg: "rgba(113,113,122,0.10)" },
  user:                   { color: "#71717a", bg: "rgba(113,113,122,0.10)" },
};

function getEventStyle(event: string) {
  if (event.startsWith("server:power.start") || event === "server:power.restart") return EVENT_STYLES["server:power.start"]!;
  if (event.startsWith("server:power.stop")) return EVENT_STYLES["server:power.stop"]!;
  if (event.startsWith("server:backup")) return EVENT_STYLES.backup!;
  if (event.startsWith("server:files")) return EVENT_STYLES.files!;
  if (event.startsWith("server:console")) return EVENT_STYLES.console!;
  if (event.startsWith("user:")) return EVENT_STYLES.user!;
  return { color: "#71717a", bg: "rgba(113,113,122,0.10)" };
}

function getEventLabel(event: string): string {
  const parts = event.split(":");
  if (parts.length >= 2) return (parts[1] ?? event).replace(".", " ");
  return event;
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Game Servers
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Link href={`/servers/${id}`} className="text-muted-foreground transition-colors hover:text-foreground">
            {server?.name ?? id}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Activity</span>
        </div>
      </header>

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[180px_200px_1fr_140px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Timestamp</span>
            <span className="text-xs font-medium text-muted-foreground">Event</span>
            <span className="text-xs font-medium text-muted-foreground">Actor</span>
            <span className="text-xs font-medium text-muted-foreground">IP Address</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activityPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Activity className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              entries.map((entry, i) => {
                const style = getEventStyle(entry.eventType);
                const isLast = i === entries.length - 1;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[180px_200px_1fr_140px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{fmtDate(entry.timestamp)}</span>
                    <span>
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-xs font-medium"
                        style={{ color: style.color, backgroundColor: style.bg }}
                      >
                        {getEventLabel(entry.eventType)}
                      </span>
                    </span>
                    <span className="truncate pr-4 text-sm text-foreground">
                      {entry.userId ?? "system"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.ip ?? "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <StatRow icon={Activity} label="Events">
            <span className="text-xl font-bold text-foreground">{entries.length}</span>
          </StatRow>
          <StatRow icon={Power} label="Power Events">
            <span className="text-xl font-bold text-foreground">{powerCount}</span>
          </StatRow>
          <StatRow icon={FileText} label="File Writes">
            <span className="text-xl font-bold" style={{ color: "#3b82f6" }}>{fileCount}</span>
          </StatRow>
          <StatRow icon={HardDrive} label="Backups">
            <span className="text-xl font-bold" style={{ color: "#a855f7" }}>{backupCount}</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
