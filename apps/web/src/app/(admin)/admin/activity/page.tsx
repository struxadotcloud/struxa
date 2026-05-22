"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, Server, Users, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
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
  server:   { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  user:     { color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  node:     { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  alloc:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  nest:     { color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  egg:      { color: "#a855f7", bg: "rgba(168,85,247,0.12)" },
  dbhost:   { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  location: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  settings: { color: "#71717a", bg: "rgba(113,113,122,0.10)" },
};

function getEventStyle(event: string): { color: string; bg: string } {
  if (event.startsWith("admin:server.")) return EVENT_STYLES.server!;
  if (event.startsWith("admin:user.")) return EVENT_STYLES.user!;
  if (event.startsWith("admin:node.")) return EVENT_STYLES.node!;
  if (event.startsWith("admin:allocation.")) return EVENT_STYLES.alloc!;
  if (event.startsWith("admin:nest.")) return EVENT_STYLES.nest!;
  if (event.startsWith("admin:egg.")) return EVENT_STYLES.egg!;
  if (event.startsWith("admin:database-host.")) return EVENT_STYLES.dbhost!;
  if (event.startsWith("admin:location.")) return EVENT_STYLES.location!;
  if (event.startsWith("admin:settings.")) return EVENT_STYLES.settings!;
  return { color: "#71717a", bg: "rgba(113,113,122,0.10)" };
}

const EVENT_LABELS: Record<string, string> = {
  "admin:server.create":          "Server: Create",
  "admin:server.delete":          "Server: Delete",
  "admin:server.update":          "Server: Update",
  "admin:server.suspend":         "Server: Suspend",
  "admin:server.unsuspend":       "Server: Unsuspend",
  "admin:server.variables":       "Server: Variables",
  "admin:node.create":            "Node: Create",
  "admin:node.update":            "Node: Update",
  "admin:node.delete":            "Node: Delete",
  "admin:node.token-regenerate":  "Node: Regen Token",
  "admin:allocation.create":      "Allocation: Create",
  "admin:allocation.delete":      "Allocation: Delete",
  "admin:nest.create":            "Nest: Create",
  "admin:nest.update":            "Nest: Update",
  "admin:nest.delete":            "Nest: Delete",
  "admin:egg.create":             "Egg: Create",
  "admin:egg.update":             "Egg: Update",
  "admin:egg.delete":             "Egg: Delete",
  "admin:egg.variable-add":       "Egg: Add Variable",
  "admin:egg.variable-update":    "Egg: Update Variable",
  "admin:egg.variable-delete":    "Egg: Delete Variable",
  "admin:egg.import":             "Egg: Import",
  "admin:user.set-role":          "User: Set Role",
  "admin:user.ban":               "User: Ban",
  "admin:user.unban":             "User: Unban",
  "admin:user.delete":            "User: Delete",
  "admin:database-host.create":   "DB Host: Create",
  "admin:database-host.update":   "DB Host: Update",
  "admin:database-host.delete":   "DB Host: Delete",
  "admin:location.create":        "Location: Create",
  "admin:location.update":        "Location: Update",
  "admin:location.delete":        "Location: Delete",
  "admin:settings.update":        "Settings: Update",
};

function getEventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

function ActorCell({ user }: { user: { name: string | null; email: string; image: string | null } | null | undefined }) {
  if (!user) return <span className="text-sm text-muted-foreground">System</span>;
  const displayName = user.name ?? user.email;
  const initials = displayName[0]!.toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground overflow-hidden">
        {user.image ? (
          <Image src={user.image} alt={displayName} width={24} height={24} className="h-6 w-6 object-cover" />
        ) : initials}
      </div>
      <span className="truncate text-sm text-foreground">{displayName}</span>
    </div>
  );
}

function getEventDetails(eventType: string, propertiesJson: string | null): string | null {
  if (!propertiesJson) return null;
  let props: Record<string, unknown>;
  try { props = JSON.parse(propertiesJson) as Record<string, unknown>; } catch { return null; }

  if (typeof props.name === "string") return props.name;
  if (typeof props.short === "string") {
    return props.long && typeof props.long === "string" ? `${props.short} — ${props.long}` : props.short;
  }
  if (typeof props.variable === "string") return props.variable;
  if (typeof props.targetUserId === "string") {
    if (typeof props.role === "string") return `→ ${props.role}`;
    if (typeof props.reason === "string") return props.reason;
    return props.targetUserId;
  }
  if (typeof props.ip === "string" && typeof props.ports === "string") return `${props.ip}:${props.ports}`;
  if (typeof props.ip === "string" && typeof props.port === "number") return `${props.ip}:${props.port}`;
  if (typeof props.key === "string") return props.key;
  return null;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function AdminActivityPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
    if (!isPending && session && session.user.role !== "admin") router.replace("/");
  }, [isPending, session, router]);

  const { data: activityData, isPending: activityPending } = useQuery({
    ...orpc.activity.adminList.queryOptions({ input: { page: 1 } }),
    enabled: !!session && session.user.role === "admin",
  });

  if (isPending || !session) return <Loader />;

  const entries = activityData?.data ?? [];
  const serverCount = entries.filter((e) => e.eventType.startsWith("admin:server.")).length;
  const userCount = entries.filter((e) => e.eventType.startsWith("admin:user.")).length;
  const infraCount = entries.filter((e) =>
    e.eventType.startsWith("admin:node.") ||
    e.eventType.startsWith("admin:allocation.") ||
    e.eventType.startsWith("admin:location.") ||
    e.eventType.startsWith("admin:database-host.") ||
    e.eventType.startsWith("admin:nest.") ||
    e.eventType.startsWith("admin:egg.") ||
    e.eventType.startsWith("admin:settings.")
  ).length;

  return (
    <>
      <div className="flex flex-1 gap-3 overflow-hidden px-4 py-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[160px_180px_200px_150px_1fr_130px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Timestamp</span>
            <span className="text-xs font-medium text-muted-foreground">Event</span>
            <span className="text-xs font-medium text-muted-foreground">Actor</span>
            <span className="text-xs font-medium text-muted-foreground">Target</span>
            <span className="text-xs font-medium text-muted-foreground">Details</span>
            <span className="text-xs font-medium text-muted-foreground">IP Address</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activityPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Activity className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No admin activity yet</p>
              </div>
            ) : (
              entries.map((entry, i) => {
                const style = getEventStyle(entry.eventType);
                const isLast = i === entries.length - 1;
                const target = entry.server?.name ?? entry.node?.name ?? null;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[160px_180px_200px_150px_1fr_130px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
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
                    <div className="min-w-0 pr-4">
                      <ActorCell user={entry.user} />
                    </div>
                    <span className="truncate pr-4 font-mono text-xs text-muted-foreground">
                      {target ?? "—"}
                    </span>
                    <span className="truncate pr-4 font-mono text-xs text-muted-foreground">
                      {getEventDetails(entry.eventType, entry.properties) ?? "—"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.ip ?? "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <StatRow icon={Activity} label="Total Events">
            <span className="text-xl font-bold text-foreground">{entries.length}</span>
          </StatRow>
          <StatRow icon={Server} label="Server Events">
            <span className="text-xl font-bold" style={{ color: "#3b82f6" }}>{serverCount}</span>
          </StatRow>
          <StatRow icon={Users} label="User Moderation">
            <span className="text-xl font-bold" style={{ color: "#f43f5e" }}>{userCount}</span>
          </StatRow>
          <StatRow icon={Layers} label="Infrastructure">
            <span className="text-xl font-bold" style={{ color: "#f59e0b" }}>{infraCount}</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
