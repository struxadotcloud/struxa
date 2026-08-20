"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, HardDrive, Clock, RotateCcw, Trash2, Download } from "lucide-react";
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
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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

function StatusDot({ backup }: { backup: { isSuccessful: boolean; completedAt: Date | string | null } }) {
  if (backup.completedAt === null) return <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />;
  if (backup.isSuccessful) return <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />;
}

export default function BackupsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.backups");
  const tc = useTranslations("common");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: backups = [], isPending: backupsPending } = useQuery({
    ...orpc.backups.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const { data: downloadAvailability } = useQuery({
    ...orpc.backups.getDownloadAvailability.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });
  const s3PublicDownloads = downloadAvailability?.s3PublicDownloads ?? false;

  const createMutation = useMutation(orpc.backups.create.mutationOptions());
  const deleteMutation = useMutation({
    ...orpc.backups.delete.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries(orpc.backups.list.queryOptions({ input: { serverId: serverId ?? "" } }));
      toast.success(tc("deleted"));
    },
  });
  const downloadMutation = useMutation({
    ...orpc.backups.getDownloadUrl.mutationOptions(),
    onSuccess: ({ url }) => window.open(url, "_blank"),
  });
  const restoreMutation = useMutation({
    ...orpc.backups.restore.mutationOptions(),
    onSuccess: () => {
      setRestoreTarget(null);
      toast.success(t("restoreSuccess"));
    },
  });

  function closeCreate() {
    setShowCreate(false);
    setCreateName("");
  }

  async function handleCreate() {
    if (!serverId || !createName.trim()) return;
    await createMutation.mutateAsync({ serverId, name: createName.trim() });
    void queryClient.invalidateQueries(orpc.backups.list.queryOptions({ input: { serverId } }));
    toast.success(tc("created"));
    closeCreate();
  }

  if (isPending || !session) return <Loader />;

  const totalBytes = backups.reduce((acc, b) => acc + Number(b.bytes ?? 0), 0);
  const lastBackup = backups[0];

  return (
    <>
      <Dialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) setRestoreTarget(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("restoreTitle")}</DialogTitle>
            <DialogDescription>
              {t("restoreDescription", { name: restoreTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={restoreMutation.isPending}
            >
              {t("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={restoreMutation.isPending}
              onClick={() => {
                if (!serverId || !restoreTarget) return;
                restoreMutation.mutate({ serverId, backupId: restoreTarget.id });
              }}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {restoreMutation.isPending ? t("restoring") : t("restoreBackup")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDescription", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={deleteMutation.isPending}
            >
              {t("cancel")}
            </DialogClose>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!serverId || !deleteTarget) return;
                deleteMutation.mutate(
                  { serverId, backupId: deleteTarget.id },
                  { onSuccess: () => setDeleteTarget(null) },
                );
              }}
              className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {deleteMutation.isPending ? t("deleting") : t("deleteBackup")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <label className="mb-1.5 block text-xs font-medium text-foreground">{t("nameLabel")}</label>
            <input
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="my-backup"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
                if (e.key === "Escape") closeCreate();
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending}
            >
              {t("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!createName.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? t("creating") : t("createBackup")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{t("sectionTitle")}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              {t("createBackup")}
            </button>
          </div>
          {backups.some((b) => b.disk === "s3") && !s3PublicDownloads && (
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <p className="text-xs text-muted-foreground">{t("downloadsDisabledHint")}</p>
            </div>
          )}
          <div className="flex flex-1 flex-col overflow-x-auto">
          <div className="min-w-[500px] flex flex-1 flex-col">
          <div className="grid grid-cols-[28px_1fr_100px_200px_100px] border-b border-border bg-muted/40 px-4 py-2.5 shrink-0">
            <span />
            <span className="text-xs font-medium text-muted-foreground">{t("colName")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colSize")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("colCreated")}</span>
            <span />
          </div>
          <div className="flex-1 overflow-y-auto">
            {backupsPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("loading")}</div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Archive className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {t("createFirst")}
                </button>
              </div>
            ) : (
              backups.map((backup, i) => {
                const isLast = i === backups.length - 1;
                return (
                  <div
                    key={backup.id}
                    className={`grid grid-cols-[28px_1fr_100px_200px_100px] items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <StatusDot backup={backup} />
                    <span className="font-mono text-sm text-foreground truncate pr-4">{backup.name}</span>
                    <span className="text-sm text-muted-foreground">{fmtBytes(Number(backup.bytes ?? 0))}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(backup.createdAt)}</span>
                    <div className="flex items-center gap-2 justify-end pr-1">
                      {backup.isSuccessful && (
                        <>
                          {(backup.disk !== "s3" || s3PublicDownloads) && (
                            <button
                              type="button"
                              onClick={() => serverId && downloadMutation.mutate({ serverId, backupId: backup.id })}
                              className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-blue-500 transition-colors"
                              title={t("download")}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setRestoreTarget({ id: backup.id, name: backup.name })}
                            className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-blue-500 transition-colors"
                            title={t("restore")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={backup.isLocked}
                        onClick={() => setDeleteTarget({ id: backup.id, name: backup.name })}
                        className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive disabled:opacity-30 transition-colors"
                        title={t("delete")}
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
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-[220px]">
          <div className="overflow-y-auto">
            <StatRow icon={Archive} label={t("statBackups")}>
              <span className="text-xl font-bold text-foreground">{backups.length}</span>
            </StatRow>
            <StatRow icon={HardDrive} label={t("statTotalSize")}>
              <span className="text-xl font-bold text-foreground">{fmtBytes(totalBytes)}</span>
            </StatRow>
            <StatRow icon={Clock} label={t("statLastBackup")}>
              <span className="text-sm font-semibold text-foreground leading-snug">
                {lastBackup ? fmtDate(lastBackup.createdAt) : "—"}
              </span>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
