"use client"

import { useEffect, useRef, useState } from "react";
import { orpc, queryClient } from "@/utils/orpc";

export type SystemStatsMessage = {
  cpu: { used: number; threads: number; cores: number; model: string };
  network: { receiving_rate: number; sending_rate: number; received: number; sent: number };
  memory: {
    used: number;
    used_process: number;
    available: number;
    total: number;
    swap: { used: number; total: number };
  };
  disk: { used: number; total: number; reading_rate: number; writing_rate: number };
  load_average: { one: number; five: number; fifteen: number };
  uptime_seconds: number;
  version: string;
  os: string;
  architecture: string;
  kernel_version: string;
};

export type SystemStatsHistory = {
  cpu: number[];
  memUsed: number[];
  memAvailable: number[];
  memTotal: number[];
  diskUsed: number[];
  diskTotal: number[];
  netRx: number[];
  netTx: number[];
  load1: number[];
};

export type StatsNode = {
  id: string;
  fqdn: string;
  scheme: string;
  daemonListen: number;
  maintenanceMode?: boolean;
};

const MAX_POINTS = 17280;
export const SAMPLE_EVERY = 5;

export function isOutdatedWings(current: string | undefined, latest: string | null): boolean {
  if (!current || !latest) return false;
  const nums = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(".")
      .map((s) => Number.parseInt(s, 10) || 0);
  const c = nums(current);
  const l = nums(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0;
    const lv = l[i] ?? 0;
    if (cv !== lv) return cv < lv;
  }
  return false;
}

function emptyHistory(): SystemStatsHistory {
  return { cpu: [], memUsed: [], memAvailable: [], memTotal: [], diskUsed: [], diskTotal: [], netRx: [], netTx: [], load1: [] };
}

function pushSample(h: SystemStatsHistory, stats: SystemStatsMessage) {
  const push = (arr: number[], v: number) => {
    arr.push(v);
    if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
  };
  push(h.cpu, stats.cpu.used);
  push(h.memUsed, stats.memory.used);
  push(h.memAvailable, stats.memory.available);
  push(h.memTotal, stats.memory.total);
  push(h.diskUsed, stats.disk.used);
  push(h.diskTotal, stats.disk.total);
  push(h.netRx, stats.network.receiving_rate);
  push(h.netTx, stats.network.sending_rate);
  push(h.load1, stats.load_average.one);
}

export function useSystemStats(node: StatsNode, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [latest, setLatest] = useState<SystemStatsMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<SystemStatsHistory>(emptyHistory);
  const [reconnectKey, setReconnectKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);
  const historyRef = useRef<SystemStatsHistory>(emptyHistory());
  const counterRef = useRef(0);

  useEffect(() => {
    historyRef.current = emptyHistory();
    counterRef.current = 0;
    setHistory(emptyHistory());
    setLatest(null);
  }, [node.id]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    intentionalCloseRef.current = false;

    void queryClient
      .fetchQuery({ ...orpc.nodes.getStatsSocket.queryOptions({ input: { id: node.id } }), staleTime: 0 })
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
          try {
            const stats = JSON.parse(event.data) as SystemStatsMessage;
            if (typeof stats.cpu?.used !== "number") return;
            setLatest(stats);
            counterRef.current += 1;
            if (counterRef.current % SAMPLE_EVERY !== 0) return;
            pushSample(historyRef.current, stats);
            setHistory({ ...historyRef.current });
          } catch {}
        };

        ws.onclose = () => {
          if (cancelled) return;
          setConnected(false);
          setLatest(null);
          if (!intentionalCloseRef.current) {
            reconnectTimer = setTimeout(() => setReconnectKey((k) => k + 1), 3000);
          }
        };
      });

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, node.id, reconnectKey, queryClient]);

  return { latest, connected, history };
}

export type FleetNodeStats = Record<string, { latest: SystemStatsMessage; history: SystemStatsHistory }>;

export function useFleetStats(nodes: StatsNode[] | undefined) {
  const [stats, setStats] = useState<FleetNodeStats>({});
  const [reconnectKey, setReconnectKey] = useState(0);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const latestRef = useRef(new Map<string, SystemStatsMessage>());
  const historyRef = useRef(new Map<string, SystemStatsHistory>());
  const countersRef = useRef(new Map<string, number>());
  const idsKey = (nodes ?? []).filter((n) => !n.maintenanceMode).map((n) => n.id).join(",");

  useEffect(() => {
    const targets = (nodesRef.current ?? []).filter((n) => !n.maintenanceMode);
    if (targets.length === 0) {
      setStats({});
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const sockets = new Map<string, WebSocket>();
    const counters = countersRef.current;
    const latestMap = latestRef.current;
    const historyMap = historyRef.current;

    const snapshot = () => {
      const next: FleetNodeStats = {};
      for (const t of targets) {
        const latest = latestMap.get(t.id);
        if (!latest) continue;
        next[t.id] = { latest, history: { ...(historyMap.get(t.id) ?? emptyHistory()) } };
      }
      setStats(next);
    };

    for (const node of targets) {
      void queryClient
        .fetchQuery({ ...orpc.nodes.getStatsSocket.queryOptions({ input: { id: node.id } }), staleTime: 0 })
        .then((wsData) => {
          if (cancelled || sockets.has(node.id)) return;
          const ws = new WebSocket(wsData.socket);
          sockets.set(node.id, ws);

          ws.onopen = () => ws.send(JSON.stringify({ event: "auth", args: [wsData.token] }));

          ws.onmessage = (event: MessageEvent<string>) => {
            try {
              const stats = JSON.parse(event.data) as SystemStatsMessage;
              if (typeof stats.cpu?.used !== "number") return;
              latestMap.set(node.id, stats);
              const count = (counters.get(node.id) ?? 0) + 1;
              counters.set(node.id, count);
              if (count % SAMPLE_EVERY !== 0) return;
              const h = historyMap.get(node.id) ?? emptyHistory();
              pushSample(h, stats);
              historyMap.set(node.id, h);
              snapshot();
            } catch {}
          };

          ws.onclose = () => {
            sockets.delete(node.id);
            latestMap.delete(node.id);
            if (cancelled) return;
            snapshot();
            if (!reconnectTimer) {
              reconnectTimer = setTimeout(() => setReconnectKey((k) => k + 1), 3000);
            }
          };
        });
    }

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const ws of sockets.values()) ws.close();
      sockets.clear();
    };
  }, [idsKey, reconnectKey, queryClient]);

  return stats;
}

export type FleetAggregate = {
  latest: {
    cpuAvg: number;
    memUsed: number;
    memAvailable: number;
    memTotal: number;
    diskUsed: number;
    diskTotal: number;
    netRx: number;
    netTx: number;
  };
  history: SystemStatsHistory;
};

export function fleetAggregate(entries: { latest: SystemStatsMessage; history: SystemStatsHistory }[]): FleetAggregate | null {
  if (entries.length === 0) return null;
  const n = entries.length;
  const sampled = entries.filter((e) => e.history.cpu.length > 0);
  const len = sampled.length === 0 ? 0 : Math.min(...sampled.map((e) => e.history.cpu.length));
  const series = (key: keyof SystemStatsHistory, mode: "sum" | "avg" = "sum") => {
    const out: number[] = [];
    for (let i = 0; i < len; i++) {
      let acc = 0;
      for (const e of sampled) {
        const arr = e.history[key] as number[];
        acc += arr[arr.length - len + i] ?? 0;
      }
      out.push(mode === "avg" ? acc / sampled.length : acc);
    }
    return out;
  };
  const sum = (f: (l: SystemStatsMessage) => number) => entries.reduce((a, e) => a + f(e.latest), 0);

  return {
    latest: {
      cpuAvg: entries.reduce((a, e) => a + e.latest.cpu.used, 0) / n,
      memUsed: sum((l) => l.memory.used),
      memAvailable: sum((l) => l.memory.available),
      memTotal: sum((l) => l.memory.total),
      diskUsed: sum((l) => l.disk.used),
      diskTotal: sum((l) => l.disk.total),
      netRx: sum((l) => l.network.receiving_rate),
      netTx: sum((l) => l.network.sending_rate),
    },
    history: {
      cpu: series("cpu", "avg"),
      memUsed: series("memUsed"),
      memAvailable: series("memAvailable"),
      memTotal: series("memTotal"),
      diskUsed: series("diskUsed"),
      diskTotal: series("diskTotal"),
      netRx: series("netRx"),
      netTx: series("netTx"),
      load1: [],
    },
  };
}
