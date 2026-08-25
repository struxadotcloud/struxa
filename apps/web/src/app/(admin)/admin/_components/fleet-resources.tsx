"use client"

import Link from "next/link";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownToLine, Cpu, Database, HardDrive, MemoryStick } from "lucide-react";
import { AreaChart } from "@struxa/ui/components/dither-kit/area-chart";
import { Area } from "@struxa/ui/components/dither-kit/area";
import { Grid } from "@struxa/ui/components/dither-kit/grid";
import { XAxis } from "@struxa/ui/components/dither-kit/x-axis";
import { YAxis } from "@struxa/ui/components/dither-kit/y-axis";
import { Legend } from "@struxa/ui/components/dither-kit/legend";
import { Tooltip } from "@struxa/ui/components/dither-kit/tooltip";
import { Sparkline } from "@struxa/ui/components/dither-kit/sparkline";
import { fleetAggregate, useFleetStats, type StatsNode } from "@/hooks/use-system-stats";
import { StatCard } from "./stat-card";
import { ChartCard } from "./chart-card";
import { buildRows, fmtGb, fmtMbps, fmtPct, timeLabel, GB, MB } from "./chart-utils";

type NodeRow = { id: string; name: string; fqdn: string; scheme: string; daemonListen: number; maintenanceMode: boolean };
type ServerRow = { node?: { id: string } | null; memory: number };

export function FleetResources({ nodes, servers }: { nodes: NodeRow[]; servers: ServerRow[] }) {
  const t = useTranslations("admin.dashboard");
  const locale = useLocale();

  const allocatedMb = useMemo(() => {
    let sum = 0;
    for (const s of servers) if (s.node) sum += s.memory;
    return sum;
  }, [servers]);

  const stats = useFleetStats(nodes as StatsNode[]);

  const agg = useMemo(() => fleetAggregate(Object.values(stats)), [stats]);

  const ramRows = useMemo(() => {
    if (!agg) return [];
    return buildRows(
      [
        { key: "memUsed", dataKey: "used" },
        { key: "memAvailable", dataKey: "available" },
      ],
      agg.history,
      (v) => v / GB,
    );
  }, [agg]);

  const cpuRows = useMemo(() => {
    if (!agg) return [];
    return buildRows([{ key: "cpu", dataKey: "cpu" }], agg.history, (v) => v);
  }, [agg]);

  const diskRows = useMemo(() => {
    if (!agg) return [];
    return buildRows([{ key: "diskUsed", dataKey: "disk" }], agg.history, (v) => v / GB);
  }, [agg]);

  const netRows = useMemo(() => {
    if (!agg) return [];
    return buildRows(
      [
        { key: "netRx", dataKey: "rx" },
        { key: "netTx", dataKey: "tx" },
      ],
      agg.history,
      (v) => v / MB,
    );
  }, [agg]);

  const length = agg?.history.cpu.length ?? 0;
  const tick = (v: unknown) => timeLabel(v as number, length, locale);

  const ramConfig = useMemo(
    () => ({
      used: { label: t("fleetRamUsed"), color: "purple" as const },
      available: { label: t("fleetRamAvailable"), color: "grey" as const },
    }),
    [t],
  );
  const cpuConfig = useMemo(() => ({ cpu: { label: t("fleetCpuLabel"), color: "blue" as const } }), [t]);
  const diskConfig = useMemo(() => ({ disk: { label: t("fleetDiskUsed"), color: "orange" as const } }), [t]);
  const netConfig = useMemo(
    () => ({
      rx: { label: t("fleetNetIn"), color: "blue" as const },
      tx: { label: t("fleetNetOut"), color: "green" as const },
    }),
    [t],
  );

  const hasData = !!agg;

  const nodeEntries = nodes
    .filter((n) => !n.maintenanceMode && stats[n.id])
    .map((n) => ({ node: n, stats: stats[n.id]! }));

  return (
    <div className="mb-6">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("resources")}</h2>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Database}
          label={t("fleetRamAllocated")}
          value={hasData ? `${(allocatedMb / 1024).toFixed(1)} GB` : "—"}
          color="#f59e0b"
        />
        <StatCard
          icon={MemoryStick}
          label={t("fleetRamUsed")}
          value={hasData ? `${(agg!.latest.memUsed / GB).toFixed(1)} GB` : "—"}
          color="#8b5cf6"
        />
        <StatCard
          icon={MemoryStick}
          label={t("fleetRamAvailable")}
          value={hasData ? `${(agg!.latest.memAvailable / GB).toFixed(1)} GB` : "—"}
          color="#22c55e"
        />
        <StatCard
          icon={Cpu}
          label={t("fleetCpuLabel")}
          value={hasData ? `${agg!.latest.cpuAvg.toFixed(0)}%` : "—"}
          color="#3b82f6"
        />
        <StatCard
          icon={HardDrive}
          label={t("fleetDiskUsed")}
          value={hasData ? `${(agg!.latest.diskUsed / GB).toFixed(1)} GB` : "—"}
          color="#f97316"
        />
        <StatCard
          icon={ArrowDownToLine}
          label={t("fleetNet")}
          value={hasData ? `${(agg!.latest.netRx / MB).toFixed(1)} MB/s` : "—"}
          sub={hasData ? `↑ ${(agg!.latest.netTx / MB).toFixed(1)}` : undefined}
          color="#22c55e"
        />
      </div>

      {hasData && (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard title={t("ramChart")} current={`${(agg!.latest.memUsed / GB).toFixed(1)} / ${(agg!.latest.memTotal / GB).toFixed(1)} GB`}>
              <AreaChart data={ramRows} config={ramConfig} stackType="stacked" margins={{ top: 30 }} animate={false} interactive>
                <Grid />
                <XAxis dataKey="t" tickFormatter={tick} />
                <YAxis tickFormatter={fmtGb} />
                <Legend />
                <Tooltip valueFormatter={fmtGb} />
                <Area dataKey="used" variant="gradient" />
                <Area dataKey="available" variant="hatched" />
              </AreaChart>
            </ChartCard>

            <ChartCard title={t("cpuChart")} current={`${agg!.latest.cpuAvg.toFixed(0)}%`}>
              <AreaChart data={cpuRows} config={cpuConfig} margins={{ top: 30 }} animate={false} interactive>
                <Grid />
                <XAxis dataKey="t" tickFormatter={tick} />
                <YAxis tickFormatter={fmtPct} />
                <Legend />
                <Tooltip valueFormatter={fmtPct} />
                <Area dataKey="cpu" variant="gradient" />
              </AreaChart>
            </ChartCard>

            <ChartCard title={t("diskChart")} current={`${(agg!.latest.diskUsed / GB).toFixed(1)} / ${(agg!.latest.diskTotal / GB).toFixed(1)} GB`}>
              <AreaChart data={diskRows} config={diskConfig} margins={{ top: 30 }} animate={false} interactive>
                <Grid />
                <XAxis dataKey="t" tickFormatter={tick} />
                <YAxis tickFormatter={fmtGb} />
                <Legend />
                <Tooltip valueFormatter={fmtGb} />
                <Area dataKey="disk" variant="gradient" />
              </AreaChart>
            </ChartCard>

            <ChartCard title={t("netChart")} current={`↓ ${(agg!.latest.netRx / MB).toFixed(1)} · ↑ ${(agg!.latest.netTx / MB).toFixed(1)} MB/s`}>
              <AreaChart data={netRows} config={netConfig} margins={{ top: 30 }} animate={false} interactive>
                <Grid />
                <XAxis dataKey="t" tickFormatter={tick} />
                <YAxis tickFormatter={fmtMbps} />
                <Legend />
                <Tooltip valueFormatter={fmtMbps} />
                <Area dataKey="rx" variant="gradient" />
                <Area dataKey="tx" variant="dotted" />
              </AreaChart>
            </ChartCard>
          </div>

          {nodeEntries.length > 0 && (
            <>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("nodesSection")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nodeEntries.map(({ node, stats: s }) => (
                  <Link
                    key={node.id}
                    href={`/admin/nodes/${node.id}` as never}
                    className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{node.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {t("nodeCpu", { value: s.latest.cpu.used.toFixed(0) })}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <div>
                        <Sparkline data={s.history.cpu} color="blue" className="h-10 w-full" />
                      </div>
                      <div>
                        <Sparkline data={s.history.memUsed} color="purple" className="h-10 w-full" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>
                        {t("nodeRam", {
                          used: (s.latest.memory.used / GB).toFixed(1),
                          total: (s.latest.memory.total / GB).toFixed(1),
                        })}
                      </span>
                      <span>
                        {t("nodeDisk", {
                          used: (s.latest.disk.used / GB).toFixed(0),
                          total: (s.latest.disk.total / GB).toFixed(0),
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
