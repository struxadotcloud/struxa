"use client";

import { useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Activity, Power, FileText, HardDrive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
  if (event === "server:reinstall") return { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" };
  if (event.startsWith("server:database")) return { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  if (event.startsWith("user:")) return EVENT_STYLES.user!;
  return { color: "#71717a", bg: "rgba(113,113,122,0.10)" };
}

const EVENT_LABEL_KEYS: Record<string, string> = {
  "server:power.start":              "eventPowerStart",
  "server:power.stop":               "eventPowerStop",
  "server:power.restart":            "eventPowerRestart",
  "server:power.kill":               "eventPowerKill",
  "server:backup.start":             "eventBackupCreate",
  "server:backup.delete":            "eventBackupDelete",
  "server:backup.restore":           "eventBackupRestore",
  "server:files.read":               "eventFilesRead",
  "server:files.write":              "eventFilesWrite",
  "server:settings":                 "eventSettingsUpdate",
  "server:reinstall":                "eventServerReinstall",
  "server:database.create":          "eventDatabaseCreate",
  "server:database.delete":          "eventDatabaseDelete",
  "server:database.rotate-password": "eventDatabaseRotatePassword",
  "server:schedule.create":          "eventScheduleCreate",
  "server:schedule.update":          "eventScheduleUpdate",
  "server:schedule.delete":          "eventScheduleDelete",
  "user:subuser-create":             "eventUsersAdd",
  "user:subuser-update":             "eventUsersUpdate",
  "user:subuser-delete":             "eventUsersRemove",
};

function ActorCell({ user, systemLabel }: { user: { name: string | null; email: string; image: string | null } | null | undefined; systemLabel: string }) {
  if (!user) return <span className="text-sm text-muted-foreground">{systemLabel}</span>;
  const displayName = user.name ?? user.email;
  const initials = displayName[0]!.toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground overflow-hidden">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={displayName} className="h-6 w-6 object-cover" />
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

  if (eventType.startsWith("server:files") && typeof props.file === "string") return props.file;
  if (eventType.startsWith("server:backup") && typeof props.name === "string") return props.name;
  if (eventType.startsWith("server:database") && typeof props.database === "string") return props.database;
  if (eventType.startsWith("server:schedule") && typeof props.name === "string") return props.name;
  if (eventType === "server:settings") {
    if (typeof props.name === "string") return `Renamed → ${props.name}`;
    if (typeof props.image === "string") return `Image → ${props.image}`;
    if (typeof props.envVariable === "string") return `Variable: ${props.envVariable}`;
  }
  if (eventType === "user:subuser-create" && typeof props.targetEmail === "string") return props.targetEmail;
  return null;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.activity");
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
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {/* Table header */}
          <div className="grid grid-cols-[160px_180px_200px_1fr_130px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("colTimestamp")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colEvent")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colActor")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colDetails")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colIp")}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activityPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("loading")}</div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Activity className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            ) : (
              entries.map((entry, i) => {
                const style = getEventStyle(entry.eventType);
                const isLast = i === entries.length - 1;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-[160px_180px_200px_1fr_130px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{fmtDate(entry.timestamp)}</span>
                    <span>
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-xs font-medium"
                        style={{ color: style.color, backgroundColor: style.bg }}
                      >
                        {EVENT_LABEL_KEYS[entry.eventType] ? t(EVENT_LABEL_KEYS[entry.eventType]) : entry.eventType}
                      </span>
                    </span>
                    <div className="min-w-0 pr-4">
                      <ActorCell user={entry.user} systemLabel={t("system")} />
                    </div>
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

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-[220px]">
          <StatRow icon={Activity} label={t("statEvents")}>
            <span className="text-xl font-bold text-foreground">{entries.length}</span>
          </StatRow>
          <StatRow icon={Power} label={t("statPowerEvents")}>
            <span className="text-xl font-bold text-foreground">{powerCount}</span>
          </StatRow>
          <StatRow icon={FileText} label={t("statFileWrites")}>
            <span className="text-xl font-bold" style={{ color: "#3b82f6" }}>{fileCount}</span>
          </StatRow>
          <StatRow icon={HardDrive} label={t("statBackups")}>
            <span className="text-xl font-bold" style={{ color: "#a855f7" }}>{backupCount}</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
