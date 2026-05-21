"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ListChecks, Trash2, Plus, ChevronRight, ChevronDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
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
  cronMinute: string;
  cronHour: string;
  cronDayOfMonth: string;
  cronDayOfWeek: string;
}): string {
  return `${sch.cronMinute} ${sch.cronHour} ${sch.cronDayOfMonth} * ${sch.cronDayOfWeek}`;
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function describeCron(minute: string, hour: string, dom: string, dow: string): string {
  const minStep = minute.match(/^\*\/(\d+)$/)?.[1];
  const hrStep = hour.match(/^\*\/(\d+)$/)?.[1];
  const minFixed = /^\d+$/.test(minute) ? parseInt(minute) : null;
  const hrFixed = /^\d+$/.test(hour) ? parseInt(hour) : null;
  const domFixed = /^\d+$/.test(dom) ? parseInt(dom) : null;
  const dowFixed = /^\d+$/.test(dow) ? parseInt(dow) % 7 : null;

  if (minute === "*" && hour === "*" && dom === "*" && dow === "*") return "Every minute";
  if (minStep && hour === "*" && dom === "*" && dow === "*")
    return `Every ${minStep} minute${minStep === "1" ? "" : "s"}`;
  if (minFixed === 0 && hour === "*" && dom === "*" && dow === "*") return "Every hour";
  if (minFixed === 0 && hrStep && dom === "*" && dow === "*")
    return `Every ${hrStep} hour${hrStep === "1" ? "" : "s"}`;

  const timeStr =
    hrFixed !== null && minFixed !== null
      ? (() => {
          const h = hrFixed % 12 || 12;
          const ampm = hrFixed < 12 ? "AM" : "PM";
          const m = minFixed.toString().padStart(2, "0");
          return `${h}:${m} ${ampm}`;
        })()
      : null;

  if (timeStr) {
    if (dom === "*" && dow === "*") return `Every day at ${timeStr}`;
    if (dom === "*" && dowFixed !== null) return `Every ${DOW_NAMES[dowFixed]} at ${timeStr}`;
    if (domFixed !== null && dow === "*") return `Monthly on day ${domFixed} at ${timeStr}`;
    if (domFixed !== null && dowFixed !== null)
      return `On day ${domFixed} or ${DOW_NAMES[dowFixed]} at ${timeStr}`;
  }

  return `${minute} ${hour} ${dom} * ${dow}`;
}

function CronField({
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
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

type TaskAction = "command" | "power" | "backup";

interface ScheduleTask {
  id: string;
  scheduleId: string;
  sequenceId: number;
  action: string;
  payload: string;
  timeOffset: number;
  continueOnFailure: boolean;
  isQueued: boolean;
}

const ACTION_LABELS: Record<TaskAction, string> = {
  command: "Command",
  power: "Power",
  backup: "Backup",
};

const ACTION_COLORS: Record<TaskAction, string> = {
  command: "bg-blue-500/10 text-blue-500",
  power: "bg-amber-500/10 text-amber-500",
  backup: "bg-purple-500/10 text-purple-500",
};

const EMPTY_TASK_FORM = {
  action: "command" as TaskAction,
  payload: "",
  timeOffset: 0,
  continueOnFailure: false,
};

function TasksPanel({
  scheduleId,
  serverId,
  tasks,
  queryClient: qc,
}: {
  scheduleId: string;
  serverId: string;
  tasks: ScheduleTask[];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);

  const createTaskMutation = useMutation({
    ...orpc.schedules.createTask.mutationOptions(),
    onSuccess: () => {
      void qc.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId } }));
      setShowModal(false);
      setTaskForm(EMPTY_TASK_FORM);
    },
  });

  const deleteTaskMutation = useMutation({
    ...orpc.schedules.deleteTask.mutationOptions(),
    onSuccess: () => void qc.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId } })),
  });

  const nextSeq = tasks.length > 0 ? Math.max(...tasks.map((t) => t.sequenceId)) + 1 : 1;

  function closeModal() {
    setShowModal(false);
    setTaskForm(EMPTY_TASK_FORM);
  }

  async function handleAddTask() {
    const payload =
      taskForm.action === "backup"
        ? ""
        : taskForm.action === "power"
          ? taskForm.payload || "restart"
          : taskForm.payload;
    await createTaskMutation.mutateAsync({
      serverId,
      scheduleId,
      sequenceId: nextSeq,
      action: taskForm.action,
      payload,
      timeOffset: taskForm.timeOffset,
      continueOnFailure: taskForm.continueOnFailure,
    });
  }

  return (
    <>
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Tasks run in sequence when the schedule fires.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Action</label>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                  <span>
                    {taskForm.action === "command" && "Command — run a console command"}
                    {taskForm.action === "power" && "Power — change server power state"}
                    {taskForm.action === "backup" && "Backup — create a server backup"}
                  </span>
                  <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg" style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}>
                  {(["command", "power", "backup"] as TaskAction[]).map((a) => (
                    <DropdownMenuItem
                      key={a}
                      onClick={() => setTaskForm((f) => ({ ...f, action: a, payload: "" }))}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${taskForm.action === a ? "bg-green-500" : "bg-transparent"}`} />
                      {a === "command" && "Command — run a console command"}
                      {a === "power" && "Power — change server power state"}
                      {a === "backup" && "Backup — create a server backup"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {taskForm.action === "command" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Command</label>
                <input
                  autoFocus
                  value={taskForm.payload}
                  onChange={(e) => setTaskForm((f) => ({ ...f, payload: e.target.value }))}
                  placeholder="say Hello World"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-ring transition-colors"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddTask(); }}
                />
              </div>
            )}

            {taskForm.action === "power" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Power Action</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring capitalize">
                    <span>{taskForm.payload || "restart"}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg" style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}>
                    {(["start", "stop", "restart", "kill"] as const).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => setTaskForm((f) => ({ ...f, payload: p }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm capitalize text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${(taskForm.payload || "restart") === p ? "bg-green-500" : "bg-transparent"}`} />
                        {p}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">Delay after previous (seconds)</label>
                <input
                  type="number"
                  min={0}
                  value={taskForm.timeOffset}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, timeOffset: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={taskForm.continueOnFailure}
                    onChange={(e) => setTaskForm((f) => ({ ...f, continueOnFailure: e.target.checked }))}
                    className="rounded"
                  />
                  Continue on failure
                </label>
              </div>
            </div>

            {createTaskMutation.isError && (
              <p className="text-xs text-destructive">{createTaskMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createTaskMutation.isPending}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleAddTask()}
              disabled={
                createTaskMutation.isPending ||
                (taskForm.action === "command" && !taskForm.payload.trim())
              }
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createTaskMutation.isPending ? "Adding…" : "Add Task"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="border-t border-border/60 bg-muted/10">
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 px-10 py-3 text-xs text-muted-foreground">
            No tasks yet — this schedule does nothing until you add one.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {tasks
              .slice()
              .sort((a, b) => a.sequenceId - b.sequenceId)
              .map((task) => {
                const action = task.action as TaskAction;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-10 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                      {task.sequenceId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTION_COLORS[action] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {ACTION_LABELS[action] ?? action}
                    </span>
                    <span className="flex-1 font-mono text-xs text-foreground truncate">
                      {task.payload || "—"}
                    </span>
                    {task.timeOffset > 0 && (
                      <span className="text-[11px] text-muted-foreground">+{task.timeOffset}s</span>
                    )}
                    {task.continueOnFailure && (
                      <span className="text-[10px] text-muted-foreground/60">continue on fail</span>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteTaskMutation.mutate({ serverId, taskId: task.id })}
                      disabled={deleteTaskMutation.isPending}
                      className="rounded p-0.5 text-muted-foreground/40 hover:bg-muted hover:text-destructive transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        <div className="border-t border-border/60 px-10 py-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add task
          </button>
        </div>
      </div>
    </>
  );
}

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    onSuccess: () =>
      void queryClient.invalidateQueries(
        orpc.schedules.list.queryOptions({ input: { serverId: serverId ?? "" } }),
      ),
  });

  function closeCreate() {
    setShowCreate(false);
    setForm({ name: "", cronMinute: "*/5", cronHour: "*", cronDayOfMonth: "*", cronDayOfWeek: "*" });
  }

  async function handleCreate() {
    if (!serverId || !form.name.trim()) return;
    const result = await createMutation.mutateAsync({
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
    if (result?.id) setExpandedId(result.id);
  }

  if (isPending || !session) return <Loader />;

  const enabled = schedules.filter((s) => s.isActive);
  const disabled = schedules.filter((s) => !s.isActive);
  const soonest = enabled
    .slice()
    .sort((a, b) =>
      a.nextRunAt && b.nextRunAt
        ? new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
        : 0,
    )[0];

  const cronDescription = describeCron(
    form.cronMinute || "*",
    form.cronHour || "*",
    form.cronDayOfMonth || "*",
    form.cronDayOfWeek || "*",
  );

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
                <CronField
                  label="Minute"
                  placeholder="*/5"
                  value={form.cronMinute}
                  onChange={(v) => setForm((f) => ({ ...f, cronMinute: v }))}
                  hint="0–59"
                />
                <CronField
                  label="Hour"
                  placeholder="*"
                  value={form.cronHour}
                  onChange={(v) => setForm((f) => ({ ...f, cronHour: v }))}
                  hint="0–23"
                />
                <CronField
                  label="Day"
                  placeholder="*"
                  value={form.cronDayOfMonth}
                  onChange={(v) => setForm((f) => ({ ...f, cronDayOfMonth: v }))}
                  hint="1–31"
                />
                <CronField
                  label="Weekday"
                  placeholder="*"
                  value={form.cronDayOfWeek}
                  onChange={(v) => setForm((f) => ({ ...f, cronDayOfWeek: v }))}
                  hint="0–7"
                />
              </div>
              <div className="mt-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">{cronDescription}</p>
                <code className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                  {form.cronMinute || "*"} {form.cronHour || "*"} {form.cronDayOfMonth || "*"} *{" "}
                  {form.cronDayOfWeek || "*"}
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
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Loading…
              </div>
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
              schedules.map((sch) => {
                const tasks = (sch.tasks ?? []) as ScheduleTask[];
                const isExpanded = expandedId === sch.id;
                return (
                  <div key={sch.id} className="border-b border-border last:border-b-0">
                    <div
                      className="grid grid-cols-[28px_1fr_160px_180px_180px_48px] items-center px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : sch.id)}
                    >
                      <button
                        type="button"
                        title={sch.isActive ? "Disable" : "Enable"}
                        onClick={(e) => {
                          e.stopPropagation();
                          serverId &&
                            toggleMutation.mutate(
                              { serverId, scheduleId: sch.id, isActive: !sch.isActive },
                              {
                                onSuccess: () =>
                                  void queryClient.invalidateQueries(
                                    orpc.schedules.list.queryOptions({ input: { serverId } }),
                                  ),
                              },
                            );
                        }}
                        className="flex items-center"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${sch.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`}
                        />
                      </button>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">{sch.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{formatCron(sch)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(sch.lastRunAt)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(sch.nextRunAt)}</span>
                      <div className="flex items-center justify-end pr-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            serverId && deleteMutation.mutate({ serverId, scheduleId: sch.id });
                          }}
                          className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && serverId && (
                      <TasksPanel
                        scheduleId={sch.id}
                        serverId={serverId}
                        tasks={tasks}
                        queryClient={queryClient}
                      />
                    )}
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
