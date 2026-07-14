"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Server } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

type DbStatus = "" | "installing" | "install_failed" | "suspended" | "restoring_backup" | string;

type StatusConfig = { color: string; bg: string; labelKey: string; pulse: boolean };

const STATUS_CONFIG: Record<string, StatusConfig> = {
  installing:       { color: "#71717a", bg: "rgba(113,113,122,0.12)", labelKey: "installing",        pulse: true  },
  install_failed:   { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   labelKey: "install_failed",    pulse: false },
  suspended:        { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   labelKey: "suspended",         pulse: false },
  restoring_backup: { color: "#71717a", bg: "rgba(113,113,122,0.12)", labelKey: "restoring_backup",  pulse: true  },
  running:          { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   labelKey: "running",           pulse: false },
  starting:         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  labelKey: "starting",          pulse: true  },
  stopping:         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  labelKey: "stopping",          pulse: true  },
  offline:          { color: "#71717a", bg: "rgba(113,113,122,0.12)", labelKey: "offline",           pulse: false },
};

function getStatus(dbStatus: DbStatus, powerState: string | undefined, loading: boolean) {
  if (dbStatus !== "") return STATUS_CONFIG[dbStatus] ?? { color: "#71717a", bg: "rgba(113,113,122,0.12)", labelKey: dbStatus, pulse: false };
  if (loading) return { color: "#71717a", bg: "rgba(113,113,122,0.08)", labelKey: "—", pulse: true };
  return STATUS_CONFIG[powerState ?? "offline"] ?? STATUS_CONFIG.offline!;
}

type ServerItem = {
  uuid: string;
  name: string;
  status: string;
  allocation: { ip: string; port: number } | null;
  egg: { name: string } | null;
};

function ServerCard({ server, powerState, statusLoading }: {
  server: ServerItem;
  powerState: string | undefined;
  statusLoading: boolean;
}) {
  const ts = useTranslations("panel.serverStatus");
  const tp = useTranslations("panel.servers");
  const status = getStatus(server.status, powerState, statusLoading);
  const label = status.labelKey in (ts as unknown as Record<string, unknown>) ? ts(status.labelKey as never) : status.labelKey;

  return (
    <Link href={`/servers/${server.uuid}`} className="group block">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:border-foreground/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${status.pulse ? "animate-pulse" : ""}`}
              style={{ backgroundColor: status.color }}
            />
            <span className="truncate text-sm font-semibold text-foreground group-hover:text-foreground">
              {server.name}
            </span>
          </div>
          {server.egg && (
            <span className="shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {server.egg.name}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {server.allocation ? `${server.allocation.ip}:${server.allocation.port}` : tp("noAllocation")}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {label}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ServersPage() {
  const t = useTranslations("panel.servers");
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  useEffect(() => {
    if (!sessionPending && !session) router.replace("/login");
  }, [sessionPending, session, router]);

  const { data: servers, isPending: serversPending } = useQuery(
    orpc.servers.list.queryOptions(),
  );

  const { data: statuses, isPending: statusesPending } = useQuery({
    ...orpc.servers.listStatuses.queryOptions(),
    enabled: !serversPending && !!servers,
    refetchInterval: 30_000,
  });

  if (sessionPending || !session) return <Loader />;

  const list = servers ?? [];

  return (
    <>
      <div className="flex-1 overflow-auto">
        {serversPending ? (
          <Loader />
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Server className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{t("noServersTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("noServersDescription")}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((server) => (
              <ServerCard
                key={server.uuid}
                server={server as ServerItem}
                powerState={statuses?.[server.uuid]}
                statusLoading={statusesPending}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
