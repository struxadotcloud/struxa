"use client"

export function UsageBar({
  used,
  total,
  allocated,
  className,
}: {
  used: number;
  total: number;
  allocated?: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const allocatedPct = allocated != null && total > 0 ? Math.min(100, (allocated / total) * 100) : null;

  return (
    <div className={`relative h-1.5 w-full overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      {allocatedPct != null && (
        <div className="absolute top-0 h-full w-0.5 bg-amber-500" style={{ left: `${allocatedPct}%` }} />
      )}
    </div>
  );
}
