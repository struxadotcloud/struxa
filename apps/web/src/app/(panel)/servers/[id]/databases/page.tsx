"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Copy, RefreshCw, Trash2, Eye, EyeOff, Plus, ChevronRight } from "lucide-react";
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

type DbRow = {
  id: string;
  database: string;
  username: string;
  password: string;
  remote: string;
  host: { host: string; port: number };
};

function DatabaseRow({ db, serverId, onRotate, onDelete }: {
  db: DbRow;
  serverId: string;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("panel.databases");
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pw, setPw] = useState(db.password);

  function copy(text: string) { void navigator.clipboard.writeText(text); }

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform ${open ? "rotate-90" : ""}`} />
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-sm font-medium text-foreground flex-1">{db.database}</span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => { onRotate(db.id); setPw(t("rotating")); }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            {t("rotatePassword")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(db.id)}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            {t("delete")}
          </button>
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-2 border-t border-border bg-muted/20">
          <div className="border-r border-border px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("fieldUsername")}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground">{db.username}</span>
              <button type="button" onClick={() => copy(db.username)} className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("fieldPassword")}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground">{visible ? pw : "••••••••••••"}</span>
              <button type="button" onClick={() => setVisible((v) => !v)} className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => copy(pw)} className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="border-r border-t border-border px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("fieldHost")}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground">{db.host.host}</span>
              <button type="button" onClick={() => copy(db.host.host)} className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("fieldPort")}</p>
            <span className="font-mono text-sm text-foreground">{db.host.port}</span>
          </div>
          <div className="col-span-2 border-t border-border px-4 py-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("fieldConnectionString")}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                mysql://{db.username}:***@{db.host.host}:{db.host.port}/{db.database}
              </span>
              <button
                type="button"
                onClick={() => copy(`mysql://${db.username}:${pw}@${db.host.host}:${db.host.port}/${db.database}`)}
                className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DatabasesPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.databases");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [dbName, setDbName] = useState("");
  const [hostId, setHostId] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));
  const serverId = server?.id;

  const { data: databases = [], isPending: dbPending } = useQuery({
    ...orpc.databases.list.queryOptions({ input: { serverId: serverId ?? "" } }),
    enabled: !!serverId,
  });

  const { data: hosts = [] } = useQuery({
    ...orpc.databaseHosts.listAvailable.queryOptions(),
    enabled: showCreate,
  });

  const createMutation = useMutation(orpc.databases.create.mutationOptions());
  const rotateMutation = useMutation({
    ...orpc.databases.rotatePassword.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries(orpc.databases.list.queryOptions({ input: { serverId: serverId ?? "" } })),
  });
  const deleteMutation = useMutation({
    ...orpc.databases.delete.mutationOptions(),
    onSuccess: () => void queryClient.invalidateQueries(orpc.databases.list.queryOptions({ input: { serverId: serverId ?? "" } })),
  });

  function closeCreate() {
    setShowCreate(false);
    setDbName("");
    setHostId("");
  }

  async function handleCreate() {
    if (!serverId || !dbName.trim() || !hostId) return;
    await createMutation.mutateAsync({ serverId, hostId, database: dbName.trim(), remote: "%" });
    void queryClient.invalidateQueries(orpc.databases.list.queryOptions({ input: { serverId } }));
    closeCreate();
  }

  if (isPending || !session) return <Loader />;

  return (
    <>
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("createTitle")}</DialogTitle>
            <DialogDescription>{t("createDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("databaseNameLabel")}</label>
              <input
                autoFocus
                value={dbName}
                onChange={(e) => setDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="my_database"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter" && hostId) void handleCreate(); if (e.key === "Escape") closeCreate(); }}
              />
              <p className="mt-1 text-xs text-muted-foreground">{t("databaseNameHint")}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("databaseHostLabel")}</label>
              {(hosts as Array<{ id: string; host: string; port: number }>).length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  {t("noHostsConfigured")}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(hosts as Array<{ id: string; host: string; port: number }>).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHostId(h.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                        hostId === h.id
                          ? "border-ring bg-muted/40 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      <span className="font-mono">{h.host}</span>
                      <span className="text-xs text-muted-foreground">:{h.port}</span>
                    </button>
                  ))}
                </div>
              )}
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
              {t("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!dbName.trim() || !hostId || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? t("creating") : t("createDatabase")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex flex-1 gap-3 overflow-hidden px-4 py-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">{t("sectionTitle")}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newDatabase")}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dbPending ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("loading")}</div>
            ) : databases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Database className="h-8 w-8 text-muted-foreground/30" />
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
              databases.map((db) => (
                <DatabaseRow
                  key={db.id}
                  db={db as DbRow}
                  serverId={serverId ?? ""}
                  onRotate={(dbId) => serverId && rotateMutation.mutate({ serverId, databaseId: dbId })}
                  onDelete={(dbId) => serverId && deleteMutation.mutate({ serverId, databaseId: dbId })}
                />
              ))
            )}
          </div>
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-y-auto">
            <StatRow icon={Database} label={t("statDatabases")}>
              <span className="text-xl font-bold text-foreground">{databases.length}</span>
            </StatRow>
            <StatRow icon={Database} label={t("statHost")}>
              <span className="font-mono text-sm font-semibold text-foreground leading-snug">
                {(databases[0] as DbRow | undefined)?.host.host ?? "—"}
              </span>
            </StatRow>
            <StatRow icon={Database} label={t("statNote")}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("statNoteText")}
              </p>
            </StatRow>
          </div>
        </aside>
      </div>
    </>
  );
}
