"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Clock, ListChecks, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function StatRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-b border-[#222222]">
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#555555]">
          <Icon className="h-3.5 w-3.5" />
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

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: schedules = [], isPending: schedulesPending } = useQuery({
    ...orpc.schedules.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const toggleMutation = useMutation(orpc.schedules.update.mutationOptions());

  const deleteMutation = useMutation({
    ...orpc.schedules.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId: serverId ?? "" } }));
    },
  });

  if (isPending || !session) return <Loader />;

  const enabled = schedules.filter((s) => s.isActive);
  const disabled = schedules.filter((s) => !s.isActive);
  const soonest = enabled
    .slice()
    .sort((a, b) => (a.nextRunAt && b.nextRunAt ? new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime() : 0))[0];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link
            href={`/servers/${id}`}
            className="text-[#555555] transition-colors hover:text-white"
          >
            {server?.name ?? id}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Schedules</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[28px_1fr_160px_180px_180px_72px] border-b border-r border-[#222222] px-3 py-2">
              <span />
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Name</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Cron</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Last Run</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Next Run</span>
              <span />
            </div>
            {schedulesPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">Loading…</div>
            ) : schedules.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">No schedules yet</div>
            ) : (
              schedules.map((sch) => (
                <div
                  key={sch.id}
                  className="grid grid-cols-[28px_1fr_160px_180px_180px_72px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
                >
                  <button
                    type="button"
                    title={sch.isActive ? "Disable" : "Enable"}
                    onClick={() => serverId && toggleMutation.mutate(
                      { serverId, scheduleId: sch.id, isActive: !sch.isActive },
                      { onSuccess: () => void queryClient.invalidateQueries(orpc.schedules.list.queryOptions({ input: { serverId } })) },
                    )}
                    className="flex items-center"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${sch.isActive ? "bg-[#22c55e]" : "bg-[#333333]"}`}
                    />
                  </button>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-white">{sch.name}</span>
                    <span className="text-[11px] text-[#555555]">
                      {(sch.tasks as unknown[]).length} task{(sch.tasks as unknown[]).length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#888888]">{formatCron(sch)}</span>
                  <span className="text-xs text-[#555555]">{fmtDate(sch.lastRunAt)}</span>
                  <span className="text-xs text-[#888888]">{fmtDate(sch.nextRunAt)}</span>
                  <div className="flex items-center gap-2 justify-end pr-1">
                    <button
                      type="button"
                      onClick={() => serverId && deleteMutation.mutate({ serverId, scheduleId: sch.id })}
                      className="text-[#444444] hover:text-[#f43f5e] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={ListChecks} label="TASKS">
            <span className="text-2xl font-bold text-white">{schedules.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="ENABLED">
            <span className="text-2xl font-bold text-[#22c55e]">{enabled.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="DISABLED">
            <span className="text-2xl font-bold text-[#555555]">{disabled.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="NEXT RUN">
            <span className="text-sm font-bold text-white leading-snug">
              {soonest ? fmtDate(soonest.nextRunAt) : "—"}
            </span>
            {soonest && (
              <span className="text-xs text-[#555555]">{soonest.name}</span>
            )}
          </StatRow>
        </aside>
      </div>
    </>
  );
}
