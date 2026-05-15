"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { mockServers, type GameServer, type ServerStatus } from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

const STATUS_DOT: Record<ServerStatus, string> = {
  running: "#22c55e",
  stopped: "#f43f5e",
  starting: "#f59e0b",
  stopping: "#f59e0b",
};

const STATUS_LABEL: Record<ServerStatus, string> = {
  running: "Running",
  stopped: "Offline",
  starting: "Starting",
  stopping: "Stopping",
};

const GAME_LABEL: Record<GameServer["game"], string> = {
  minecraft: "Minecraft",
  rust: "Rust",
  cs2: "CS2",
  tf2: "TF2",
  ark: "ARK",
};

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function ResourceBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const color = pct > 80 ? "#f43f5e" : pct > 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="h-1 w-full bg-[#222222]">
      <div className="h-1 transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ServerCard({ server }: { server: GameServer }) {
  const dot = STATUS_DOT[server.status];
  return (
    <Link href={`/servers/${server.id}`} className="block">
      <div className="flex flex-col gap-3 border-r border-b border-[#222222] p-4 transition-colors hover:bg-[#111111]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
            <span className="truncate text-sm font-semibold text-white">{server.name}</span>
          </div>
          <span className="shrink-0 border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#888888]">
            {GAME_LABEL[server.game]}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#555555]">
          <span>
            {server.ip}:{server.port}
          </span>
          <span className="text-[#333333]">·</span>
          <span>{server.node}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="uppercase tracking-wider text-[#555555]">CPU</span>
              <span className="font-mono text-white">{server.resources.cpu}%</span>
            </div>
            <ResourceBar value={server.resources.cpu} max={100} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="uppercase tracking-wider text-[#555555]">Players</span>
              <span className="font-mono text-white">
                {server.players.current} / {server.players.max}
              </span>
            </div>
            <ResourceBar value={server.players.current} max={server.players.max} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="uppercase tracking-wider text-[#555555]">RAM</span>
              <span className="font-mono text-white">
                {fmtMb(server.resources.ram.used)} / {fmtMb(server.resources.ram.total)}
              </span>
            </div>
            <ResourceBar value={server.resources.ram.used} max={server.resources.ram.total} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[10px]">
              <span className="uppercase tracking-wider text-[#555555]">Disk</span>
              <span className="font-mono text-white">
                {fmtMb(server.resources.disk.used)} / {fmtMb(server.resources.disk.total)}
              </span>
            </div>
            <ResourceBar value={server.resources.disk.used} max={server.resources.disk.total} />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: dot }}>{STATUS_LABEL[server.status]}</span>
          <span className="font-mono text-[#555555]">{server.uptime ?? "—"}</span>
        </div>
      </div>
    </Link>
  );
}

export default function ServersPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const running = mockServers.filter((s) => s.status === "running").length;

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <span className="text-sm text-white">Game Servers</span>
          <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
            {mockServers.length} total
          </span>
          <span className="border border-[#22c55e]/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#22c55e]">
            {running} online
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
        <div className="grid grid-cols-2">
          {mockServers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      </div>
    </>
  );
}
