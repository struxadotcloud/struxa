"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Clock, ListChecks, Play, Trash2, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockSchedules } from "@/lib/mock-data";
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

export default function SchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];
  const enabled = mockSchedules.filter((s) => s.enabled);
  const disabled = mockSchedules.filter((s) => !s.enabled);
  const soonest = enabled
    .slice()
    .sort((a, b) => a.nextRun.localeCompare(b.nextRun))[0];

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
            href={`/servers/${server.id}`}
            className="text-[#555555] transition-colors hover:text-white"
          >
            {server.name}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Schedules</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#1a1a1a] border border-[#333333] text-white hover:bg-[#222222] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Schedule
        </button>
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
            {mockSchedules.map((sch) => (
              <div
                key={sch.id}
                className="grid grid-cols-[28px_1fr_160px_180px_180px_72px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${sch.enabled ? "bg-[#22c55e]" : "bg-[#333333]"}`}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-white">{sch.name}</span>
                  <span className="text-[11px] text-[#555555]">{sch.action}</span>
                </div>
                <span className="font-mono text-xs text-[#888888]">{sch.cron}</span>
                <span className="text-xs text-[#555555]">{sch.lastRun ?? "—"}</span>
                <span className="text-xs text-[#888888]">{sch.nextRun}</span>
                <div className="flex items-center gap-2 justify-end pr-1">
                  <button
                    type="button"
                    className="text-[#444444] hover:text-[#22c55e] transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="text-[#444444] hover:text-[#f43f5e] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-[#222222]">
          <StatRow icon={ListChecks} label="TASKS">
            <span className="text-2xl font-bold text-white">{mockSchedules.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="ENABLED">
            <span className="text-2xl font-bold text-[#22c55e]">{enabled.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="DISABLED">
            <span className="text-2xl font-bold text-[#555555]">{disabled.length}</span>
          </StatRow>
          <StatRow icon={Clock} label="NEXT RUN">
            <span className="text-sm font-bold text-white leading-snug">
              {soonest?.nextRun ?? "—"}
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
