"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Button } from "@struxa/ui/components/button";
import { Server } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

type DbStatus = "" | "installing" | "install_failed" | "suspended" | "restoring_backup" | string;

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; pulse: boolean }> = {
  installing:       { color: "#71717a", bg: "rgba(113,113,122,0.12)", label: "Installing",       pulse: true  },
  install_failed:   { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   label: "Failed",           pulse: false },
  suspended:        { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",   label: "Suspended",        pulse: false },
  restoring_backup: { color: "#71717a", bg: "rgba(113,113,122,0.12)", label: "Restoring",        pulse: true  },
  running:          { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Running",          pulse: false },
  starting:         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Starting",         pulse: true  },
  stopping:         { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Stopping",         pulse: true  },
  offline:          { color: "#71717a", bg: "rgba(113,113,122,0.12)", label: "Offline",          pulse: false },
};

function getStatus(dbStatus: DbStatus, powerState: string | undefined, loading: boolean) {
  if (dbStatus !== "") return STATUS_CONFIG[dbStatus] ?? { color: "#71717a", bg: "rgba(113,113,122,0.12)", label: dbStatus, pulse: false };
  if (loading) return { color: "#71717a", bg: "rgba(113,113,122,0.08)", label: "—", pulse: true };
  return STATUS_CONFIG[powerState ?? "offline"] ?? STATUS_CONFIG.offline!;
}

type Server = {
  uuid: string;
  name: string;
  status: string;
  allocation: { ip: string; port: number } | null;
  egg: { name: string } | null;
};

function ServerCard({ server, powerState, statusLoading }: {
  server: Server;
  powerState: string | undefined;
  statusLoading: boolean;
}) {
  const status = getStatus(server.status, powerState, statusLoading);

  return (
    <Link href={`/servers/${server.uuid}`} className="group block">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-border/80">
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
          <span className="font-mono text-xs text-muted-foreground">
            {server.allocation ? `${server.allocation.ip}:${server.allocation.port}` : "No allocation"}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ color: status.color, backgroundColor: status.bg }}
          >
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ServersPage() {
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
  const online = statuses ? list.filter((s) => statuses[s.uuid] === "running").length : 0;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Game Servers</span>
          </div>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {list.length}
          </span>
          {statuses && online > 0 && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
              {online} online
            </span>
          )}
        </div>
        <Button size="sm" type="button">
          Top up
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        {serversPending ? (
          <Loader />
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Server className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No servers yet</p>
              <p className="text-xs text-muted-foreground">Your servers will appear here once created.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((server) => (
              <ServerCard
                key={server.uuid}
                server={server as Server}
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
