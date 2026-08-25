"use client"

export function ChartCard({
  title,
  current,
  children,
}: {
  title: string;
  current?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {current && <span className="font-mono text-xs text-foreground">{current}</span>}
      </div>
      <div className="h-48">{children}</div>
    </div>
  );
}
