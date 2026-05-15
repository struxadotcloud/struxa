"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import {
  Globe,
  Clock,
  Cpu,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Users,
  Settings,
  Maximize2,
  Copy,
  SendHorizontal,
  MemoryStick,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  mockServers,
  mockConsoleLines,
  mockNetworkIn,
  mockNetworkOut,
  mockCpuHistory,
  mockRamHistory,
  mockDiskHistory,
  type ConsoleLine as ConsoleLineData,
} from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function Sparkline({ data, color = "#22c55e" }: { data: number[]; color?: string }) {
  const h = 56;
  const W = 248;
  const max = Math.max(...data, 1);
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: h - (v / max) * h,
  }));
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${h} ${line} ${W},${h}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="block h-14 w-full" preserveAspectRatio="none">
      <polygon points={area} fill={color} fillOpacity={0.15} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

function StatRow({
  icon: Icon,
  label,
  chart,
  children,
}: {
  icon: LucideIcon;
  label: string;
  chart?: React.ReactNode;
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
      {chart}
    </div>
  );
}

function ConsoleLine({ line }: { line: ConsoleLineData }) {
  if (line.type === "system") {
    return (
      <div className="my-1.5 border border-[#222222] px-3 py-1 font-mono text-xs text-[#555555]">
        {line.text}
      </div>
    );
  }
  return (
    <div className="flex gap-3 font-mono text-xs leading-relaxed">
      <span className="w-16 shrink-0 text-[#444444]">{line.time}</span>
      <span className={line.type === "prompt" ? "text-[#22c55e]" : "text-[#aaaaaa]"}>
        {line.text}
      </span>
    </div>
  );
}

export default function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">{server.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={server.status !== "stopped"}
            className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#22c55e] text-black enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start
          </button>
          <button
            type="button"
            disabled={server.status !== "running"}
            className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#f59e0b] text-black enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Restart
          </button>
          <button
            type="button"
            disabled={server.status !== "running"}
            className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#f43f5e] text-white enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Stop
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222222] px-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
              <span className="text-sm text-white">Connected</span>
            </div>
            <div className="flex items-center gap-3 text-[#555555]">
              <Settings className="h-4 w-4 cursor-pointer hover:text-white" />
              <Maximize2 className="h-4 w-4 cursor-pointer hover:text-white" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {mockConsoleLines.map((line, i) => (
              <ConsoleLine key={i} line={line} />
            ))}
          </div>

          <div className="flex h-11 shrink-0 items-center border-t border-[#222222] bg-[#0d0d0d]">
            <span className="px-3 font-mono text-sm text-[#555555]">{">"}</span>
            <input
              className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#444444]"
              placeholder="Type a command..."
            />
            <button
              type="button"
              className="px-4 text-[#555555] transition-colors hover:text-[#22c55e]"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={Globe} label="ADDRESS">
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-white">
                {server.ip}:{server.port}
              </span>
              <Copy className="h-3.5 w-3.5 cursor-pointer text-[#555555] hover:text-white" />
            </div>
          </StatRow>
          <StatRow icon={Clock} label="UPTIME">
            <span className="text-2xl font-bold text-white">{server.uptime ?? "—"}</span>
          </StatRow>
          <StatRow
            icon={Cpu}
            label="CPU"
            chart={<Sparkline data={mockCpuHistory} color="#3b82f6" />}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{server.resources.cpu}%</span>
              <span className="text-sm text-[#555555]">/ 200%</span>
            </div>
          </StatRow>
          <StatRow
            icon={MemoryStick}
            label="MEMORY"
            chart={<Sparkline data={mockRamHistory} color="#a855f7" />}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">
                {fmtMb(server.resources.ram.used)}
              </span>
              <span className="text-sm text-[#555555]">/ {fmtMb(server.resources.ram.total)}</span>
            </div>
          </StatRow>
          <StatRow
            icon={HardDrive}
            label="DISK"
            chart={<Sparkline data={mockDiskHistory} color="#f43f5e" />}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">
                {fmtMb(server.resources.disk.used)}
              </span>
              <span className="text-sm text-[#555555]">/ {fmtMb(server.resources.disk.total)}</span>
            </div>
          </StatRow>
          <StatRow icon={ArrowDown} label="INBOUND" chart={<Sparkline data={mockNetworkIn} />}>
            <span className="text-2xl font-bold text-white">0 B/s</span>
          </StatRow>
          <StatRow icon={ArrowUp} label="OUTBOUND" chart={<Sparkline data={mockNetworkOut} />}>
            <span className="text-2xl font-bold text-white">0 B/s</span>
          </StatRow>
          <StatRow icon={Users} label="PLAYERS">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{server.players.current}</span>
              <span className="text-sm text-[#555555]">/ {server.players.max}</span>
            </div>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
