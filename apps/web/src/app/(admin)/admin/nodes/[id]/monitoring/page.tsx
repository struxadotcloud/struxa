"use client";

import { use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownToLine, Clock, Cpu, Database, Gauge, HardDrive, MemoryStick } from "lucide-react";
import { AreaChart } from "@struxa/ui/components/dither-kit/area-chart";
import { Area } from "@struxa/ui/components/dither-kit/area";
import { Grid } from "@struxa/ui/components/dither-kit/grid";
import { XAxis } from "@struxa/ui/components/dither-kit/x-axis";
import { YAxis } from "@struxa/ui/components/dither-kit/y-axis";
import { Legend } from "@struxa/ui/components/dither-kit/legend";
import { Tooltip } from "@struxa/ui/components/dither-kit/tooltip";
import { orpc } from "@/utils/orpc";
import { isOutdatedWings, useSystemStats } from "@/hooks/use-system-stats";
import { StatCard } from "../../../_components/stat-card";
import { ChartCard } from "../../../_components/chart-card";
import { buildRows, formatUptime, fmtGb, fmtMbps, fmtPct, timeLabel, GB, MB } from "../../../_components/chart-utils";

export default function NodeMonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin.monitoring");
  const locale = useLocale();

  const { data: node } = useQuery(orpc.nodes.get.queryOptions({ input: { id } }));
  const { data: servers } = useQuery(orpc.servers.list.queryOptions());
  const { data: latestWingsVersion } = useQuery({
    ...orpc.nodes.getLatestWingsVersion.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const stats = useSystemStats(
    { id, fqdn: node?.fqdn ?? "", scheme: node?.scheme ?? "https", daemonListen: node?.daemonListen ?? 8080 },
    { enabled: !!node },
  );

  const allocatedMb = useMemo(() => {
    let sum = 0;
    for (const s of servers ?? []) if ((s as { node?: { id: string } | null }).node?.id === id) sum += s.memory;
    return sum;
  }, [servers, id]);

  const latest = stats.latest;
  const outdated = isOutdatedWings(latest?.version, latestWingsVersion ?? null);

  const ramRows = useMemo(
    () =>
      buildRows(
        [
          { key: "memUsed", dataKey: "used" },
          { key: "memAvailable", dataKey: "available" },
        ],
        stats.history,
        (v) => v / GB,
      ),
    [stats.history],
  );
  const cpuRows = useMemo(() => buildRows([{ key: "cpu", dataKey: "cpu" }], stats.history, (v) => v), [stats.history]);
  const diskRows = useMemo(() => buildRows([{ key: "diskUsed", dataKey: "disk" }], stats.history, (v) => v / GB), [stats.history]);
  const netRows = useMemo(
    () =>
      buildRows(
        [
          { key: "netRx", dataKey: "rx" },
          { key: "netTx", dataKey: "tx" },
        ],
        stats.history,
        (v) => v / MB,
      ),
    [stats.history],
  );

  const length = stats.history.cpu.length;
  const tick = (v: unknown) => timeLabel(v as number, length, locale);

  const ramConfig = useMemo(
    () => ({
      used: { label: t("used"), color: "purple" as const },
      available: { label: t("available"), color: "grey" as const },
    }),
    [t],
  );
  const cpuConfig = useMemo(() => ({ cpu: { label: t("cpuUsage"), color: "blue" as const } }), [t]);
  const diskConfig = useMemo(() => ({ disk: { label: t("diskUsed"), color: "orange" as const } }), [t]);
  const netConfig = useMemo(
    () => ({
      rx: { label: t("networkIn"), color: "blue" as const },
      tx: { label: t("networkOut"), color: "green" as const },
    }),
    [t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Database}
          label={t("allocatedRam")}
          value={`${(allocatedMb / 1024).toFixed(1)} GB`}
          color="#f59e0b"
        />
        <StatCard
          icon={MemoryStick}
          label={t("realUsage")}
          value={latest ? `${(latest.memory.used / GB).toFixed(1)} GB` : "—"}
          color="#8b5cf6"
        />
        <StatCard
          icon={MemoryStick}
          label={t("availableRam")}
          value={latest ? `${(latest.memory.available / GB).toFixed(1)} GB` : "—"}
          color="#22c55e"
        />
        <StatCard
          icon={Cpu}
          label={t("cpuUsage")}
          value={latest ? `${latest.cpu.used.toFixed(0)}%` : "—"}
          color="#3b82f6"
        />
        <StatCard
          icon={Gauge}
          label={t("loadAverage")}
          value={latest ? latest.load_average.one.toFixed(2) : "—"}
          sub={latest ? `${latest.load_average.five.toFixed(2)} · ${latest.load_average.fifteen.toFixed(2)}` : undefined}
          color="#f59e0b"
        />
        <StatCard
          icon={Clock}
          label={t("uptime")}
          value={latest ? formatUptime(latest.uptime_seconds, locale) : "—"}
          color="#22c55e"
        />
        <StatCard
          icon={HardDrive}
          label={t("diskUsage")}
          value={latest ? `${(latest.disk.used / GB).toFixed(1)} GB` : "—"}
          sub={latest ? `/ ${(latest.disk.total / GB).toFixed(0)} GB` : undefined}
          color="#f97316"
        />
        <StatCard
          icon={ArrowDownToLine}
          label={t("network")}
          value={latest ? `${(latest.network.receiving_rate / MB).toFixed(1)} MB/s` : "—"}
          sub={latest ? `↑ ${(latest.network.sending_rate / MB).toFixed(1)}` : undefined}
          color="#3b82f6"
        />
      </div>

      {latest && (
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="mb-2 block text-xs font-medium text-muted-foreground">{t("systemInfo")}</span>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("cpuModel")}</dt>
              <dd className="truncate text-foreground">{latest.cpu.model}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("cpuCount")}</dt>
              <dd className="text-foreground">
                {latest.cpu.cores} / {latest.cpu.threads}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("os")}</dt>
              <dd className="text-foreground">{latest.os}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("kernelVersion")}</dt>
              <dd className="truncate text-foreground">{latest.kernel_version}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("architecture")}</dt>
              <dd className="text-foreground">{latest.architecture}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{t("wingsVersion")}</dt>
              <dd className="flex items-center gap-2 text-foreground">
                {latest.version}
                {outdated && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                    {t("updateAvailable", { latest: latestWingsVersion ?? "" })}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {latest && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <ChartCard title={t("ramChart")} current={`${(latest.memory.used / GB).toFixed(1)} / ${(latest.memory.total / GB).toFixed(1)} GB`}>
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

          <ChartCard title={t("cpuChart")} current={`${latest.cpu.used.toFixed(0)}%`}>
            <AreaChart data={cpuRows} config={cpuConfig} margins={{ top: 30 }} animate={false} interactive>
              <Grid />
              <XAxis dataKey="t" tickFormatter={tick} />
              <YAxis tickFormatter={fmtPct} />
              <Legend />
              <Tooltip valueFormatter={fmtPct} />
              <Area dataKey="cpu" variant="gradient" />
            </AreaChart>
          </ChartCard>

          <ChartCard title={t("diskChart")} current={`${(latest.disk.used / GB).toFixed(1)} / ${(latest.disk.total / GB).toFixed(1)} GB`}>
            <AreaChart data={diskRows} config={diskConfig} margins={{ top: 30 }} animate={false} interactive>
              <Grid />
              <XAxis dataKey="t" tickFormatter={tick} />
              <YAxis tickFormatter={fmtGb} />
              <Legend />
              <Tooltip valueFormatter={fmtGb} />
              <Area dataKey="disk" variant="gradient" />
            </AreaChart>
          </ChartCard>

          <ChartCard title={t("netChart")} current={`↓ ${(latest.network.receiving_rate / MB).toFixed(1)} · ↑ ${(latest.network.sending_rate / MB).toFixed(1)} MB/s`}>
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
      )}

      {!latest && !stats.connected && (
        <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          {t("offline")}
        </div>
      )}
    </div>
  );
}
