import { SAMPLE_EVERY, type SystemStatsHistory } from "@/hooks/use-system-stats";

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

export function timeLabel(originalIndex: number, length: number, locale?: string) {
  const msAgo = (length - 1 - originalIndex) * SAMPLE_EVERY * 1000;
  return new Date(Date.now() - msAgo).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export type SeriesSpec = { key: keyof SystemStatsHistory; dataKey: string };

export function buildRows(series: SeriesSpec[], history: SystemStatsHistory, convert: (v: number) => number) {
  const src = history[series[0]!.key] as number[];
  if (src.length === 0) return [];
  const stride = Math.max(1, Math.ceil(src.length / 4000));
  const rows: Record<string, number>[] = [];
  for (let i = 0; i < src.length; i += stride) {
    const row: Record<string, number> = { t: i };
    for (const s of series) row[s.dataKey] = convert((history[s.key] as number[])[i] ?? 0);
    rows.push(row);
  }
  return rows;
}

export const fmtGb = (v: number) => `${Math.round(v)} GB`;
export const fmtMbps = (v: number) => `${Math.round(v)} MB/s`;
export const fmtPct = (v: number) => `${Math.round(v)}%`;

export function formatUptime(seconds: number, locale?: string) {
  const unit = (value: number, unit: "day" | "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(value);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${unit(days, "day")} ${unit(hours, "hour")}`;
  if (hours > 0) return `${unit(hours, "hour")} ${unit(minutes, "minute")}`;
  return unit(minutes, "minute");
}
