"use client";

import { useEffect, useRef, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Cpu,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Copy,
  SendHorizontal,
  MemoryStick,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Loader from "@/components/loader";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@struxa/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";

function fmtUptime(ms: number): string {
  if (ms <= 0) return "—";
  const secs = Math.floor(ms / 1000);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

function Sparkline({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  const h = 48;
  const W = 248;
  const max = Math.max(...data, 1);
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: h - (v / max) * h,
  }));
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${h} ${line} ${W},${h}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="block h-12 w-full" preserveAspectRatio="none">
      <polygon points={area} fill={color} fillOpacity={0.12} />
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
    <div className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex flex-col gap-1.5 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" />
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

function processConsoleLine(raw: string): string {
  // Split on cursor-horizontal-absolute (\x1b[nG) — spinner animations emit
  // \x1b[1G\x1b[0K<char> in a loop to overwrite the same position. Treat each
  // G-delimited segment as a "frame" and keep the last one with visible content.
  const frames = raw.split(/\x1b\[\d*G/);
  let result = frames[0] ?? '';
  for (let i = 1; i < frames.length; i++) {
    const frame = (frames[i] ?? '').replace(/^\x1b\[\d*[JK]/g, '');
    if (frame.replace(/\x1b\[[\d;]*m/g, '').trim()) result = frame;
  }
  // Strip any remaining non-SGR escape sequences (erase, cursor, etc.)
  return result.replace(/\x1b\[[\d;]*[a-ln-zA-Z]/g, '');
}

function AnsiLine({ raw }: { raw: string }) {
  const spans = parseAnsi(processConsoleLine(raw));
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
  const t = useTranslations("panel.console");
  const tStatus = useTranslations("panel.serverStatus");
  const tc = useTranslations("common");
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
  const ZERO_STATS = { cpu: 0, memBytes: 0, memLimitBytes: 0, diskMb: 0, rxBytes: 0, txBytes: 0, uptimeMs: 0 };
  const [stats, setStats] = useState(ZERO_STATS);
  const statsRef = useRef(ZERO_STATS);
  const [cpuHistory, setCpuHistory] = useState<number[]>(EMPTY_HISTORY);
  const [ramHistory, setRamHistory] = useState<number[]>(EMPTY_HISTORY);
  const [diskHistory, setDiskHistory] = useState<number[]>(EMPTY_HISTORY);
  const [rxHistory, setRxHistory] = useState<number[]>(EMPTY_HISTORY);
  const [txHistory, setTxHistory] = useState<number[]>(EMPTY_HISTORY);
  const [eulaDialogOpen, setEulaDialogOpen] = useState(false);
  const [javaDialogOpen, setJavaDialogOpen] = useState(false);
  const [javaSelectedImage, setJavaSelectedImage] = useState("");
  const eulaShownRef = useRef(false);
  const javaShownRef = useRef(false);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const eggFeaturesRef = useRef<string[]>([]);
  const serverImageRef = useRef("");
  useEffect(() => {
    const prev = eggFeaturesRef.current;
    try {
      const parsed = JSON.parse(server?.egg?.features ?? "[]") as string[];
      eggFeaturesRef.current = Array.isArray(parsed) ? parsed : [];
    } catch {
      eggFeaturesRef.current = [];
    }
    serverImageRef.current = server?.image ?? "";
    const features = eggFeaturesRef.current;
    if (prev.length === 0 && features.length > 0) {
      if (features.includes("eula") && !eulaShownRef.current && lines.some((l) => /you need to agree to the eula/i.test(l))) {
        eulaShownRef.current = true;
        setEulaDialogOpen(true);
      }
      if (features.includes("java_version") && !javaShownRef.current && lines.some((l) => /unrecognized option|could not create the java virtual machine|unsupported java|requires java/i.test(l))) {
        javaShownRef.current = true;
        setJavaSelectedImage(serverImageRef.current);
        setJavaDialogOpen(true);
      }
    }
  }, [server?.egg?.features, server?.image, lines]);

  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    intentionalClose.current = false;

    const ZERO = { cpu: 0, memBytes: 0, memLimitBytes: 0, diskMb: 0, rxBytes: 0, txBytes: 0, uptimeMs: 0 };

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
            const features = eggFeaturesRef.current;
            if (features.includes("eula") && !eulaShownRef.current && /you need to agree to the eula/i.test(line)) {
              eulaShownRef.current = true;
              setEulaDialogOpen(true);
            }
            if (features.includes("java_version") && !javaShownRef.current && /unrecognized option|could not create the java virtual machine|unsupported java|requires java/i.test(line)) {
              javaShownRef.current = true;
              setJavaSelectedImage(serverImageRef.current);
              setJavaDialogOpen(true);
            }
          } else if (msg.event === "stats") {
            try {
              const raw = JSON.parse(msg.args?.[0] ?? "{}") as {
                cpu_absolute?: number;
                memory_bytes?: number;
                memory_limit_bytes?: number;
                disk_bytes?: number;
                uptime?: number;
                network?: { rx_bytes?: number; tx_bytes?: number };
              };
              const cpu = raw.cpu_absolute ?? 0;
              const memBytes = raw.memory_bytes ?? 0;
              const memLimitBytes = raw.memory_limit_bytes ?? 0;
              const diskMb = (raw.disk_bytes ?? 0) / (1024 * 1024);
              const rxBytes = raw.network?.rx_bytes ?? 0;
              const txBytes = raw.network?.tx_bytes ?? 0;
              const uptimeMs = raw.uptime ?? 0;
              statsRef.current = { cpu, memBytes, memLimitBytes, diskMb, rxBytes, txBytes, uptimeMs };
              setStats({ cpu, memBytes, memLimitBytes, diskMb, rxBytes, txBytes, uptimeMs });
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
    const intervalId = setInterval(() => {
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
    return () => clearInterval(intervalId);
  }, []);

  const powerMutation = useMutation(orpc.servers.power.mutationOptions());

  const [eulaAccepting, setEulaAccepting] = useState(false);
  async function acceptEula() {
    setEulaAccepting(true);
    try {
      const res = await fetch(`/api/servers/${id}/files/write?file=${encodeURIComponent("/eula.txt")}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n",
      });
      if (!res.ok) throw new Error(await res.text());
      setEulaDialogOpen(false);
      toast.success(t("eulaAcceptedToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("eulaErrorToast"));
    } finally {
      setEulaAccepting(false);
    }
  }

  const updateImageMutation = useMutation({
    ...orpc.servers.updateDockerImage.mutationOptions(),
    onSuccess: () => {
      setJavaDialogOpen(false);
      void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
      toast.success(t("javaImageUpdatedToast"));
    },
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

  const alloc = server?.allocation as { ip: string; ipAlias: string | null; port: number } | null | undefined;
  const allocDisplay = alloc ? `${alloc.ipAlias ?? alloc.ip}:${alloc.port}` : "—";
  const canStart = wsStatus === "offline";
  const canStop = wsStatus === "running";
  const canKill = wsStatus === "starting" || wsStatus === "stopping";
  const canRestart = wsStatus === "running";

  const wsStatusColor =
    wsStatus === "running"
      ? "#22c55e"
      : wsStatus === "starting" || wsStatus === "stopping"
        ? "#f59e0b"
        : "#71717a";

  const dockerImageOptions: { tag: string; label: string }[] = (() => {
    try {
      const parsed = JSON.parse(server?.egg?.dockerImages ?? "{}") as Record<string, string>;
      return Object.entries(parsed).map(([alias, tag]) => ({ tag, label: alias || tag }));
    } catch { return []; }
  })();

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        {/* Console panel */}
        <div className="flex min-h-[50vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background md:min-h-0">
          <div className="flex h-10 shrink-0 items-center justify-between rounded-t-xl border-b border-border/50 bg-card px-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  !connected
                    ? "animate-pulse bg-zinc-600"
                    : wsStatus === "running"
                      ? "bg-green-500"
                      : wsStatus === "starting" || wsStatus === "stopping"
                        ? "animate-pulse bg-amber-500"
                        : "bg-zinc-600"
                }`}
              />
              <span className="text-xs font-medium" style={{ color: wsStatusColor }}>
                {tStatus(wsStatus)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canStart || powerMutation.isPending}
                onClick={() => powerMutation.mutate({ serverId: id, action: "start" })}
                className="rounded-md bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {t("start")}
              </button>
              <button
                type="button"
                disabled={!canRestart || powerMutation.isPending}
                onClick={() => powerMutation.mutate({ serverId: id, action: "restart" })}
                className="rounded-md bg-zinc-700/60 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {t("restart")}
              </button>
              {canKill ? (
                <button
                  type="button"
                  disabled={powerMutation.isPending}
                  onClick={() => powerMutation.mutate({ serverId: id, action: "kill" })}
                  className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {t("kill")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canStop || powerMutation.isPending}
                  onClick={() => powerMutation.mutate({ serverId: id, action: "stop" })}
                  className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {t("stop")}
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {lines.length === 0 ? (
              <div className="text-zinc-700">{t("waitingOutput")}</div>
            ) : (
              lines.map((line, i) => (
                <div key={i} className="leading-relaxed text-zinc-400 whitespace-pre-wrap break-all">
                  <AnsiLine raw={line} />
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>

          <div className="flex h-11 shrink-0 items-center rounded-b-xl border-t border-border/50 bg-card">
            <span className="px-3 font-mono text-sm text-zinc-600">{">"}</span>
            <input
              className="flex-1 bg-transparent font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
              placeholder={t("commandPlaceholder")}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendCommand();
              }}
            />
            <button
              type="button"
              onClick={sendCommand}
              className="px-3 text-zinc-600 transition-colors hover:text-blue-400"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Stats panel */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-[260px]">
          <div className="overflow-y-auto">
            <StatRow icon={Globe} label={t("statsAddress")}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {allocDisplay}
                </span>
                {alloc && (
                  <button
                    type="button"
                    onClick={() => copy(allocDisplay)}
                    className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </StatRow>
            <StatRow icon={Timer} label={t("statsUptime")}>
              <span className="text-sm font-semibold text-foreground">{fmtUptime(stats.uptimeMs)}</span>
            </StatRow>
            <StatRow icon={Cpu} label={t("statsCpu")} chart={<Sparkline data={cpuHistory} color="#3b82f6" />}>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{stats.cpu.toFixed(1)}%</span>
                <span className="text-xs text-muted-foreground">/ {server?.cpu ?? 0}%</span>
              </div>
            </StatRow>
            <StatRow icon={MemoryStick} label={t("statsMemory")} chart={<Sparkline data={ramHistory} color="#a855f7" />}>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">
                  {fmtMb(stats.memBytes / (1024 * 1024))}
                </span>
                <span className="text-xs text-muted-foreground">/ {fmtMb(stats.memLimitBytes / (1024 * 1024))}</span>
              </div>
            </StatRow>
            <StatRow icon={HardDrive} label={t("statsDisk")} chart={<Sparkline data={diskHistory} color="#f43f5e" />}>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{fmtMb(stats.diskMb)}</span>
                <span className="text-xs text-muted-foreground">/ {fmtMb(server?.disk ?? 0)}</span>
              </div>
            </StatRow>
            <StatRow icon={ArrowDown} label={t("statsInbound")} chart={<Sparkline data={rxHistory} />}>
              <span className="text-xl font-bold text-foreground">{fmtBytes(rxHistory[rxHistory.length - 1] ?? 0)}</span>
            </StatRow>
            <StatRow icon={ArrowUp} label={t("statsOutbound")} chart={<Sparkline data={txHistory} />}>
              <span className="text-xl font-bold text-foreground">{fmtBytes(txHistory[txHistory.length - 1] ?? 0)}</span>
            </StatRow>
          </div>
        </aside>
      </div>

      <Dialog open={eulaDialogOpen} onOpenChange={(open) => { if (!open) eulaShownRef.current = false; setEulaDialogOpen(open); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("eulaTitle")}</DialogTitle>
            <DialogDescription>{t("eulaDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setEulaDialogOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              disabled={eulaAccepting}
              onClick={() => void acceptEula()}
              className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("eulaAccept")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={javaDialogOpen} onOpenChange={(open) => { if (!open) javaShownRef.current = false; setJavaDialogOpen(open); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("javaTitle")}</DialogTitle>
            <DialogDescription>{t("javaDescription")}</DialogDescription>
          </DialogHeader>
          {dockerImageOptions.length > 0 && (
            <div className="px-5 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-border/80 hover:bg-muted data-[popup-open]:border-ring">
                  <span className="truncate">{dockerImageOptions.find((o) => o.tag === javaSelectedImage)?.label ?? javaSelectedImage}</span>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="shadow-md">
                  {dockerImageOptions.map(({ tag, label }) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => setJavaSelectedImage(tag)}
                      className="flex cursor-pointer items-center gap-2.5 text-sm"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tag === javaSelectedImage ? "bg-blue-500" : "bg-transparent"}`} />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setJavaDialogOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              disabled={updateImageMutation.isPending || !javaSelectedImage}
              onClick={() => updateImageMutation.mutate({ serverId: id, image: javaSelectedImage })}
              className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("javaApply")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
