"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import {
  Globe,
  Clock,
  Cpu,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Settings,
  Maximize2,
  Copy,
  SendHorizontal,
  MemoryStick,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
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

type WsStatus = "offline" | "running" | "starting" | "stopping";

const ANSI_FG: Record<number, string> = {
  30: "#4a4a4a", 31: "#f43f5e", 32: "#22c55e", 33: "#f59e0b",
  34: "#3b82f6", 35: "#a855f7", 36: "#06b6d4", 37: "#cccccc",
  90: "#777777", 91: "#fb7185", 92: "#4ade80", 93: "#fbbf24",
  94: "#60a5fa", 95: "#c084fc", 96: "#22d3ee", 97: "#ffffff",
};
const ANSI_BG: Record<number, string> = {
  40: "#4a4a4a", 41: "#f43f5e", 42: "#22c55e", 43: "#f59e0b",
  44: "#3b82f6", 45: "#a855f7", 46: "#06b6d4", 47: "#cccccc",
  100: "#777777", 101: "#fb7185", 102: "#4ade80", 103: "#fbbf24",
  104: "#60a5fa", 105: "#c084fc", 106: "#22d3ee", 107: "#ffffff",
};

interface AnsiSpan { text: string; color?: string; bg?: string; bold?: boolean }

function parseAnsi(raw: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  // ESC can be \x1b or its literal replacement ; also match bare [ sequences Wings strips ESC from
  const re = /\x1b\[([0-9;]*)m/g;
  let pos = 0;
  let color: string | undefined;
  let bg: string | undefined;
  let bold = false;

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) {
      spans.push({ text: raw.slice(pos, m.index), color, bg, bold });
    }
    const codes = m[1] === "" ? [0] : m[1].split(";").map(Number);
    for (const code of codes) {
      if (code === 0) { color = undefined; bg = undefined; bold = false; }
      else if (code === 1) { bold = true; }
      else if (code === 22) { bold = false; }
      else if (ANSI_FG[code]) { color = ANSI_FG[code]; }
      else if (ANSI_BG[code]) { bg = ANSI_BG[code]; }
    }
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) spans.push({ text: raw.slice(pos), color, bg, bold });
  return spans;
}

function AnsiLine({ raw }: { raw: string }) {
  const spans = parseAnsi(raw);
  return (
    <>
      {spans.map((s, i) => (
        <span
          key={i}
          style={{
            color: s.color,
            backgroundColor: s.bg,
            fontWeight: s.bold ? "bold" : undefined,
          }}
        >
          {s.text}
        </span>
      ))}
    </>
  );
}

const EMPTY_HISTORY = Array(60).fill(0) as number[];

export default function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const wsRef = useRef<WebSocket | null>(null);
  const intentionalClose = useRef(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const prevRxRef = useRef(0);
  const prevTxRef = useRef(0);
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [wsStatus, setWsStatus] = useState<WsStatus>("offline");
  const [connected, setConnected] = useState(false);
  const ZERO_STATS = { cpu: 0, memBytes: 0, memLimitBytes: 0, diskMb: 0, rxBytes: 0, txBytes: 0 };
  const [stats, setStats] = useState(ZERO_STATS);
  const statsRef = useRef(ZERO_STATS);
  const [cpuHistory, setCpuHistory] = useState<number[]>(EMPTY_HISTORY);
  const [ramHistory, setRamHistory] = useState<number[]>(EMPTY_HISTORY);
  const [diskHistory, setDiskHistory] = useState<number[]>(EMPTY_HISTORY);
  const [rxHistory, setRxHistory] = useState<number[]>(EMPTY_HISTORY);
  const [txHistory, setTxHistory] = useState<number[]>(EMPTY_HISTORY);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));

  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    intentionalClose.current = false;

    const ZERO = { cpu: 0, memBytes: 0, memLimitBytes: 0, diskMb: 0, rxBytes: 0, txBytes: 0 };

    void queryClient
      .fetchQuery({
        ...orpc.servers.getWebSocketToken.queryOptions({ input: { serverId: id } }),
        staleTime: 0,
      })
      .then((wsData) => {
        if (cancelled) return;

        const ws = new WebSocket(wsData.socket);
        wsRef.current = ws;
        setConnected(false);

        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({ event: "auth", args: [wsData.token] }));
        };

        ws.onmessage = (event: MessageEvent<string>) => {
          const msg = JSON.parse(event.data) as { event: string; args?: string[] };

          if (msg.event === "auth success") {
            ws.send(JSON.stringify({ event: "send logs", args: [] }));
            ws.send(JSON.stringify({ event: "send stats", args: [] }));
          } else if (msg.event === "console output") {
            const line = msg.args?.[0] ?? "";
            setLines((prev) => [...prev.slice(-499), line]);
          } else if (msg.event === "stats") {
            try {
              const raw = JSON.parse(msg.args?.[0] ?? "{}") as {
                cpu_absolute?: number;
                memory_bytes?: number;
                memory_limit_bytes?: number;
                disk_bytes?: number;
                network?: { rx_bytes?: number; tx_bytes?: number };
              };
              const cpu = raw.cpu_absolute ?? 0;
              const memBytes = raw.memory_bytes ?? 0;
              const memLimitBytes = raw.memory_limit_bytes ?? 0;
              const diskMb = (raw.disk_bytes ?? 0) / (1024 * 1024);
              const rxBytes = raw.network?.rx_bytes ?? 0;
              const txBytes = raw.network?.tx_bytes ?? 0;
              statsRef.current = { cpu, memBytes, memLimitBytes, diskMb, rxBytes, txBytes };
              setStats({ cpu, memBytes, memLimitBytes, diskMb, rxBytes, txBytes });
            } catch {}
          } else if (msg.event === "status") {
            const status = (msg.args?.[0] as WsStatus) ?? "offline";
            setWsStatus(status);
            if (status === "offline") {
              statsRef.current = ZERO;
              setStats(ZERO);
            }
          } else if (msg.event === "token expiring") {
            void queryClient
              .fetchQuery({
                ...orpc.servers.getWebSocketToken.queryOptions({ input: { serverId: id } }),
                staleTime: 0,
              })
              .then((fresh) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ event: "auth", args: [fresh.token] }));
                }
              });
          }
        };

        ws.onclose = () => {
          if (cancelled) return;
          setConnected(false);
          statsRef.current = ZERO;
          setStats(ZERO);
          if (!intentionalClose.current) {
            setTimeout(() => setReconnectKey((k) => k + 1), 3000);
          }
        };
      });

    return () => {
      cancelled = true;
      intentionalClose.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [reconnectKey, queryClient, id]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    const id = setInterval(() => {
      const s = statsRef.current;
      const rxRate = Math.max(0, s.rxBytes - prevRxRef.current) / 2;
      const txRate = Math.max(0, s.txBytes - prevTxRef.current) / 2;
      prevRxRef.current = s.rxBytes;
      prevTxRef.current = s.txBytes;
      setCpuHistory((prev) => [...prev.slice(1), s.cpu]);
      setRamHistory((prev) => [...prev.slice(1), s.memBytes / (1024 * 1024)]);
      setDiskHistory((prev) => [...prev.slice(1), s.diskMb]);
      setRxHistory((prev) => [...prev.slice(1), rxRate]);
      setTxHistory((prev) => [...prev.slice(1), txRate]);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const powerMutation = useMutation({
    ...orpc.servers.power.mutationOptions(),
  });


  function sendCommand() {
    if (!command.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "send command", args: [command.trim()] }));
    setCommand("");
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  if (isPending || !session) return <Loader />;

  const alloc = server?.allocation as { ip: string; port: number } | null | undefined;
  const canStart = wsStatus === "offline";
  const canStop = wsStatus === "running";
  const canKill = wsStatus === "starting" || wsStatus === "stopping";
  const canRestart = wsStatus === "running";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">{server?.name ?? id}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canStart || powerMutation.isPending}
            onClick={() => powerMutation.mutate({ serverId: id, action: "start" })}
            className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#22c55e] text-black enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start
          </button>
          <button
            type="button"
            disabled={!canRestart || powerMutation.isPending}
            onClick={() => powerMutation.mutate({ serverId: id, action: "restart" })}
            className="px-4 py-1.5 text-sm font-medium transition-opacity bg-neutral-700 text-white enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Restart
          </button>
          {canKill ? (
            <button
              type="button"
              disabled={powerMutation.isPending}
              onClick={() => powerMutation.mutate({ serverId: id, action: "kill" })}
              className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#f43f5e] text-white enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Kill
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStop || powerMutation.isPending}
              onClick={() => powerMutation.mutate({ serverId: id, action: "stop" })}
              className="px-4 py-1.5 text-sm font-medium transition-opacity bg-[#f43f5e] text-white enabled:hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Stop
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222222] px-4">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  !connected
                    ? "bg-[#555555] animate-pulse"
                    : wsStatus === "running"
                      ? "bg-[#22c55e]"
                      : wsStatus === "starting" || wsStatus === "stopping"
                        ? "bg-[#888888] animate-pulse"
                        : "bg-[#555555]"
                }`}
              />
              <span className="text-sm text-white capitalize">{wsStatus}</span>
            </div>
            <div className="flex items-center gap-3 text-[#555555]">
              <Settings className="h-4 w-4 cursor-pointer hover:text-white" />
              <Maximize2 className="h-4 w-4 cursor-pointer hover:text-white" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
            {lines.length === 0 ? (
              <div className="text-[#444444]">Waiting for console output…</div>
            ) : (
              lines.map((line, i) => (
                <div key={i} className="leading-relaxed text-[#aaaaaa] whitespace-pre-wrap break-all">
                  <AnsiLine raw={line} />
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>

          <div className="flex h-11 shrink-0 items-center border-t border-[#222222] bg-[#0d0d0d]">
            <span className="px-3 font-mono text-sm text-[#555555]">{">"}</span>
            <input
              className="flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-[#444444]"
              placeholder="Type a command..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCommand();
              }}
            />
            <button
              type="button"
              onClick={sendCommand}
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
                {alloc ? `${alloc.ip}:${alloc.port}` : "—"}
              </span>
              {alloc && (
                <Copy
                  className="h-3.5 w-3.5 cursor-pointer text-[#555555] hover:text-white"
                  onClick={() => copy(`${alloc.ip}:${alloc.port}`)}
                />
              )}
            </div>
          </StatRow>
          <StatRow icon={Clock} label="STATUS">
            <span className="text-xl font-bold text-white capitalize">{wsStatus}</span>
          </StatRow>
          <StatRow icon={Cpu} label="CPU" chart={<Sparkline data={cpuHistory} color="#3b82f6" />}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{stats.cpu.toFixed(1)}%</span>
              <span className="text-sm text-[#555555]">/ {server?.cpu ?? 0}%</span>
            </div>
          </StatRow>
          <StatRow icon={MemoryStick} label="MEMORY" chart={<Sparkline data={ramHistory} color="#a855f7" />}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">
                {fmtMb(stats.memBytes / (1024 * 1024))}
              </span>
              <span className="text-sm text-[#555555]">/ {fmtMb(stats.memLimitBytes / (1024 * 1024))}</span>
            </div>
          </StatRow>
          <StatRow icon={HardDrive} label="DISK" chart={<Sparkline data={diskHistory} color="#f43f5e" />}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">{fmtMb(stats.diskMb)}</span>
              <span className="text-sm text-[#555555]">/ {fmtMb(server?.disk ?? 0)}</span>
            </div>
          </StatRow>
          <StatRow icon={ArrowDown} label="INBOUND" chart={<Sparkline data={rxHistory} />}>
            <span className="text-2xl font-bold text-white">{fmtBytes(rxHistory[rxHistory.length - 1] ?? 0)}</span>
          </StatRow>
          <StatRow icon={ArrowUp} label="OUTBOUND" chart={<Sparkline data={txHistory} />}>
            <span className="text-2xl font-bold text-white">{fmtBytes(txHistory[txHistory.length - 1] ?? 0)}</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
