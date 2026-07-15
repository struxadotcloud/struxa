import { AlertTriangle } from "lucide-react";

function DangerZone({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <p className="text-sm font-semibold text-destructive">{title}</p>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function DangerZoneRow({
  title,
  description,
  extra,
  children,
}: {
  title: string;
  description: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        {extra}
      </div>
      {children}
    </div>
  );
}

export { DangerZone, DangerZoneRow };
