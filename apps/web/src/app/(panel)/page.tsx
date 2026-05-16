"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

type DbStatus = "" | "installing" | "install_failed" | "suspended" | "restoring_backup" | string;
type PowerState = "offline" | "running" | "starting" | "stopping" | string;

const LIFECYCLE_DOT: Record<string, string> = {
  installing: "#f59e0b",
  install_failed: "#f43f5e",
  suspended: "#f43f5e",
  restoring_backup: "#f59e0b",
};
const LIFECYCLE_LABEL: Record<string, string> = {
  installing: "Installing",
  install_failed: "Failed",
  suspended: "Suspended",
  restoring_backup: "Restoring",
};

const POWER_DOT: Record<string, string> = {
  running: "#22c55e",
  starting: "#f59e0b",
  stopping: "#f59e0b",
  offline: "#555555",
};
const POWER_LABEL: Record<string, string> = {
  running: "Running",
  starting: "Starting",
  stopping: "Stopping",
  offline: "Offline",
};

const PULSE_STATES = new Set(["installing", "restoring_backup", "starting", "stopping"]);

function getDisplay(status: DbStatus, powerState: PowerState): { dot: string; label: string; pulse: boolean } {
  if (status !== "") {
    return {
      dot: LIFECYCLE_DOT[status] ?? "#888888",
      label: LIFECYCLE_LABEL[status] ?? status,
      pulse: PULSE_STATES.has(status),
    };
  }
  return {
    dot: POWER_DOT[powerState] ?? "#555555",
    label: POWER_LABEL[powerState] ?? powerState,
    pulse: PULSE_STATES.has(powerState),
  };
}

type Server = {
  uuid: string;
  name: string;
  status: string;
  powerState: string | null;
  allocation: { ip: string; port: number } | null;
  egg: { name: string } | null;
};

function ServerCard({ server }: { server: Server }) {
  const { dot, label, pulse } = getDisplay(server.status, server.powerState ?? "offline");
  return (
    <Link href={`/servers/${server.uuid}`} className="block">
      <div className="flex flex-col gap-3 border-r border-b border-[#222222] p-4 transition-colors hover:bg-[#111111]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${pulse ? "animate-pulse" : ""}`}
              style={{ backgroundColor: dot }}
            />
            <span className="truncate text-sm font-semibold text-white">{server.name}</span>
          </div>
          {server.egg && (
            <span className="shrink-0 border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#888888]">
              {server.egg.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#555555]">
          {server.allocation ? (
            <span>
              {server.allocation.ip}:{server.allocation.port}
            </span>
          ) : (
            <span>No allocation</span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: dot }}>{label}</span>
          <span className="font-mono text-[#555555]">—</span>
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

  const { data: servers, isPending: serversPending } = useQuery({
    ...orpc.servers.list.queryOptions(),
    refetchInterval: 30_000,
  });

  if (sessionPending || !session) return <Loader />;

  const list = servers ?? [];
  const online = list.filter((s) => s.powerState === "running").length;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <span className="text-sm text-white">Game Servers</span>
          <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
            {list.length} total
          </span>
          <span className="border border-[#22c55e]/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#22c55e]">
            {online} online
          </span>
        </div>
        <button
          className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
          type="button"
        >
          Top up
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {serversPending ? (
          <Loader />
        ) : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <span className="text-sm text-[#555555]">No servers yet</span>
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {list.map((server) => (
              <ServerCard
                key={server.uuid}
                server={server as Server}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
