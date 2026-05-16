"use client";

import { useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Archive, HardDrive, Clock, RotateCcw, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { mockServers, mockBackups, type BackupStatus } from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

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

function StatusDot({ status }: { status: BackupStatus }) {
  if (status === "complete") return <span className="h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />;
  if (status === "creating") return <span className="h-2 w-2 shrink-0 rounded-full bg-[#f59e0b] animate-pulse" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-[#f43f5e]" />;
}

export default function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];
  const totalSize = mockBackups.reduce((acc, b) => acc + b.sizeMb, 0);
  const lastBackup = mockBackups[0];

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
          <span className="text-white">Backups</span>
        </div>
        <button
          type="button"
          className="px-4 py-1.5 text-sm font-medium bg-[#f59e0b] text-black hover:opacity-80 transition-opacity"
        >
          Create Backup
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[28px_1fr_100px_200px_80px] border-b border-r border-[#222222] px-3 py-2">
              <span />
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Name</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Size</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Created</span>
              <span />
            </div>
            {mockBackups.map((backup) => (
              <div
                key={backup.id}
                className="grid grid-cols-[28px_1fr_100px_200px_80px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
              >
                <StatusDot status={backup.status} />
                <span className="font-mono text-sm text-white truncate pr-4">{backup.name}</span>
                <span className="text-sm text-[#888888]">
                  {backup.sizeMb > 0 ? fmtMb(backup.sizeMb) : "—"}
                </span>
                <span className="text-xs text-[#555555]">{backup.createdAt}</span>
                <div className="flex items-center gap-3 justify-end pr-1">
                  {backup.status === "complete" && (
                    <button
                      type="button"
                      className="text-[#444444] hover:text-[#22c55e] transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
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
          <StatRow icon={Archive} label="BACKUPS">
            <span className="text-2xl font-bold text-white">{mockBackups.length}</span>
          </StatRow>
          <StatRow icon={HardDrive} label="TOTAL SIZE">
            <span className="text-2xl font-bold text-white">{fmtMb(totalSize)}</span>
          </StatRow>
          <StatRow icon={Clock} label="LAST BACKUP">
            <span className="text-sm font-bold text-white leading-snug">
              {lastBackup?.createdAt ?? "—"}
            </span>
          </StatRow>
          <StatRow icon={Clock} label="RETENTION">
            <span className="text-2xl font-bold text-white">7</span>
            <span className="text-xs text-[#555555]">days</span>
          </StatRow>
        </aside>
      </div>
    </>
  );
}
