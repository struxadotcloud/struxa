"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Archive, HardDrive, Clock, RotateCcw, Trash2, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
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

function StatusDot({ backup }: { backup: { isSuccessful: boolean; completedAt: Date | string | null } }) {
  if (backup.completedAt === null) return <span className="h-2 w-2 shrink-0 rounded-full bg-[#888888] animate-pulse" />;
  if (backup.isSuccessful) return <span className="h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-[#f43f5e]" />;
}

export default function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [createName, setCreateName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: backups = [], isPending: backupsPending } = useQuery({
    ...orpc.backups.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const createMutation = useMutation(orpc.backups.create.mutationOptions());

  const deleteMutation = useMutation({
    ...orpc.backups.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.backups.list.queryOptions({ input: { serverId: serverId ?? "" } }));
    },
  });

  const downloadMutation = useMutation({
    ...orpc.backups.getDownloadUrl.mutationOptions(),
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
  });

  const restoreMutation = useMutation({
    ...orpc.backups.restore.mutationOptions(),
  });

  if (isPending || !session) return <Loader />;

  const totalBytes = backups.reduce((acc, b) => acc + Number(b.bytes ?? 0), 0);
  const lastBackup = backups[0];

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
          <span className="text-white">Backups</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-1.5 text-sm font-medium bg-white text-black hover:opacity-80 transition-opacity"
        >
          Create Backup
        </button>
      </header>

      {showCreate && (
        <div className="border-b border-[#222222] bg-[#0d0d0d] px-4 py-3 flex items-center gap-3">
          <input
            autoFocus
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Backup name..."
            className="flex-1 bg-[#141414] border border-[#333333] px-2 py-1.5 text-sm text-white outline-none focus:border-[#555555] font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && serverId && createName.trim()) {
                createMutation.mutate({ serverId, name: createName.trim() }, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries(orpc.backups.list.queryOptions({ input: { serverId } }));
                    setShowCreate(false);
                    setCreateName("");
                  },
                });
              }
              if (e.key === "Escape") setShowCreate(false);
            }}
          />
          <button
            type="button"
            disabled={!serverId || !createName.trim() || createMutation.isPending}
            onClick={() => {
              if (serverId && createName.trim()) {
                createMutation.mutate({ serverId, name: createName.trim() }, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries(orpc.backups.list.queryOptions({ input: { serverId } }));
                    setShowCreate(false);
                    setCreateName("");
                  },
                });
              }
            }}
            className="px-4 py-1.5 text-sm font-medium bg-[#f59e0b] text-black disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="px-3 py-1.5 text-sm text-[#555555] hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-l border-[#222222]">
            <div className="grid grid-cols-[28px_1fr_100px_200px_100px] border-b border-r border-[#222222] px-3 py-2">
              <span />
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Name</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Size</span>
              <span className="text-[10px] uppercase tracking-widest text-[#555555]">Created</span>
              <span />
            </div>
            {backupsPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">Loading…</div>
            ) : backups.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#555555]">No backups yet</div>
            ) : (
              backups.map((backup) => (
                <div
                  key={backup.id}
                  className="grid grid-cols-[28px_1fr_100px_200px_100px] items-center border-b border-r border-[#222222] px-3 py-3 hover:bg-[#111111] transition-colors"
                >
                  <StatusDot backup={backup} />
                  <span className="font-mono text-sm text-white truncate pr-4">{backup.name}</span>
                  <span className="text-sm text-[#888888]">
                    {fmtBytes(Number(backup.bytes ?? 0))}
                  </span>
                  <span className="text-xs text-[#555555]">{fmtDate(backup.createdAt)}</span>
                  <div className="flex items-center gap-3 justify-end pr-1">
                    {backup.isSuccessful && (
                      <>
                        <button
                          type="button"
                          onClick={() => serverId && downloadMutation.mutate({ serverId, backupId: backup.id })}
                          className="text-[#444444] hover:text-[#3b82f6] transition-colors"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => serverId && restoreMutation.mutate({ serverId, backupId: backup.id })}
                          className="text-[#444444] hover:text-[#22c55e] transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={backup.isLocked || deleteMutation.isPending}
                      onClick={() => serverId && deleteMutation.mutate({ serverId, backupId: backup.id })}
                      className="text-[#444444] hover:text-[#f43f5e] disabled:opacity-30 transition-colors"
                      title="Delete"
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
          <StatRow icon={Archive} label="BACKUPS">
            <span className="text-2xl font-bold text-white">{backups.length}</span>
          </StatRow>
          <StatRow icon={HardDrive} label="TOTAL SIZE">
            <span className="text-2xl font-bold text-white">{fmtBytes(totalBytes)}</span>
          </StatRow>
          <StatRow icon={Clock} label="LAST BACKUP">
            <span className="text-sm font-bold text-white leading-snug">
              {lastBackup ? fmtDate(lastBackup.createdAt) : "—"}
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
