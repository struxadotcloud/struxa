"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ListChecks, Trash2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function StatRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex flex-col gap-1.5 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function formatCron(sch: {
  cronSecond: string;
  cronMinute: string;
  cronHour: string;
  cronDayOfMonth: string;
  cronDayOfWeek: string;
}): string {
  return `${sch.cronMinute} ${sch.cronHour} ${sch.cronDayOfMonth} * ${sch.cronDayOfWeek}`;
}

function CronField({ label, placeholder, value, onChange, hint }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
      />
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cronMinute: "*/5",
    cronHour: "*",
    cronDayOfMonth: "*",
    cronDayOfWeek: "*",
  });

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: schedules = [], isPending: schedulesPending } = useQuery({
    ...orpc.schedules.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const createMutation = useMutation(orpc.schedules.create.mutationOptions());
  const toggleMutation = useMutation(orpc.schedules.update.mutationOptions());
  const deleteMutation = useMutation({
    ...orpc.schedules.delete.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId: serverId ?? "" } })),
  });

  function closeCreate() {
    setShowCreate(false);
    setForm({ name: "", cronMinute: "*/5", cronHour: "*", cronDayOfMonth: "*", cronDayOfWeek: "*" });
  }

  async function handleCreate() {
    if (!serverId || !form.name.trim()) return;
    await createMutation.mutateAsync({
      serverId,
      name: form.name.trim(),
      isActive: true,
      cronSecond: "0",
      cronMinute: form.cronMinute || "*",
      cronHour: form.cronHour || "*",
      cronDayOfMonth: form.cronDayOfMonth || "*",
      cronDayOfWeek: form.cronDayOfWeek || "*",
    });
    void queryClient.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId } }));
    closeCreate();
  }

  if (isPending || !session) return <Loader />;

  const enabled = schedules.filter((s) => s.isActive);
  const disabled = schedules.filter((s) => !s.isActive);
  const soonest = enabled
    .slice()
    .sort((a, b) => (a.nextRunAt && b.nextRunAt ? new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime() : 0))[0];

  return (
    <>
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Create Schedule</DialogTitle>
            <DialogDescription>Set up an automated task using cron syntax.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Schedule Name</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Daily restart"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Cron Expression</p>
              <div className="grid grid-cols-4 gap-2">
                <CronField label="Minute" placeholder="*/5" value={form.cronMinute} onChange={(v) => setForm((f) => ({ ...f, cronMinute: v }))} hint="0-59" />
                <CronField label="Hour" placeholder="*" value={form.cronHour} onChange={(v) => setForm((f) => ({ ...f, cronHour: v }))} hint="0-23" />
                <CronField label="Day" placeholder="*" value={form.cronDayOfMonth} onChange={(v) => setForm((f) => ({ ...f, cronDayOfMonth: v }))} hint="1-31" />
                <CronField label="Weekday" placeholder="*" value={form.cronDayOfWeek} onChange={(v) => setForm((f) => ({ ...f, cronDayOfWeek: v }))} hint="0-7" />
              </div>
              <div className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">Preview: </span>
                <code className="font-mono text-xs text-foreground">
                  {form.cronMinute || "*"} {form.cronHour || "*"} {form.cronDayOfMonth || "*"} * {form.cronDayOfWeek || "*"}
                </code>
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">{createMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!form.name.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? "Creating…" : "Create Schedule"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex flex-1 gap-3 overflow-hidden px-4 py-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">Schedules</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" />
              New Schedule
            </button>
          </div>
          <div className="grid grid-cols-[28px_1fr_160px_180px_180px_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <span className="text-xs font-medium text-muted-foreground">Cron</span>
            <span className="text-xs font-medium text-muted-foreground">Last Run</span>
            <span className="text-xs font-medium text-muted-foreground">Next Run</span>
            <span />
          </div>
          <div className="flex-1 overflow-y-auto">
            {schedulesPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Clock className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No schedules yet</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Create first schedule
                </button>
              </div>
            ) : (
              schedules.map((sch, i) => {
                const isLast = i === schedules.length - 1;
                return (
                  <div
                    key={sch.id}
                    className={`grid grid-cols-[28px_1fr_160px_180px_180px_48px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <button
                      type="button"
                      title={sch.isActive ? "Disable" : "Enable"}
                      onClick={() =>
                        serverId &&
                        toggleMutation.mutate(
                          { serverId, scheduleId: sch.id, isActive: !sch.isActive },
                          { onSuccess: () => void queryClient.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId } })) },
                        )
                      }
                      className="flex items-center"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${sch.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    </button>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">{sch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(sch.tasks as unknown[]).length} task{(sch.tasks as unknown[]).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{formatCron(sch)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(sch.lastRunAt)}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(sch.nextRunAt)}</span>
                    <div className="flex items-center justify-end pr-1">
                      <button
                        type="button"
                        onClick={() => serverId && deleteMutation.mutate({ serverId, scheduleId: sch.id })}
                        className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-y-auto">
            <StatRow icon={ListChecks} label="Schedules">
              <span className="text-xl font-bold text-foreground">{schedules.length}</span>
            </StatRow>
            <StatRow icon={Clock} label="Enabled">
              <span className="text-xl font-bold text-green-500">{enabled.length}</span>
            </StatRow>
            <StatRow icon={Clock} label="Disabled">
              <span className="text-xl font-bold text-muted-foreground">{disabled.length}</span>
            </StatRow>
            <StatRow icon={Clock} label="Next Run">
              <span className="text-sm font-semibold text-foreground leading-snug">
                {soonest ? fmtDate(soonest.nextRunAt) : "—"}
              </span>
              {soonest && <span className="text-xs text-muted-foreground">{soonest.name}</span>}
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
