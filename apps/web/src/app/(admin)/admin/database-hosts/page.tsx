"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@struxa/ui/components/select";
import { Switch } from "@struxa/ui/components/switch";
import { GroupedMultiSelect } from "@struxa/ui/components/grouped-multi-select";
import { orpc, queryClient } from "@/utils/orpc";
import { RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

type TestResult = { ok: boolean; error?: string };

const databaseEngineTypes = ["mysql", "mariadb", "postgresql", "mongodb", "redis"] as const;
type DatabaseEngineType = (typeof databaseEngineTypes)[number];
const defaultPorts: Record<DatabaseEngineType, number> = {
  mysql: 3306,
  mariadb: 3306,
  postgresql: 5432,
  mongodb: 27017,
  redis: 6379,
};

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.databaseHosts.key() });
}

export default function DatabaseHostsPage() {
  const t = useTranslations("admin.databaseHosts");
  const tc = useTranslations("common");
  const tt = useTranslations("common.databaseTypes");

  const { data: hosts, isLoading } = useQuery(orpc.databaseHosts.list.queryOptions());
  const { data: nodes } = useQuery(orpc.nodes.list.queryOptions());
  const nodeGroups = useMemo(
    () => (!nodes?.length ? [] : [{ id: "all", label: t("allowedNodesLabel"), items: nodes.map((n) => ({ id: n.id, label: n.name })) }]),
    [nodes, t],
  );
  const createMutation = useMutation(orpc.databaseHosts.create.mutationOptions({
    onSuccess: () => { invalidate(); toast.success(tc("saved")); },
  }));
  const updateMutation = useMutation(orpc.databaseHosts.update.mutationOptions({
    onSuccess: () => { invalidate(); toast.success(tc("saved")); },
  }));
  const deleteMutation = useMutation(orpc.databaseHosts.delete.mutationOptions({
    onSuccess: () => { invalidate(); toast.success(tc("deleted")); },
  }));
  const testMutation = useMutation(orpc.databaseHosts.testConnection.mutationOptions());

  const emptyForm = {
    name: "",
    type: "mysql" as DatabaseEngineType,
    host: "",
    port: 3306,
    username: "",
    password: "",
    ssl: false,
    maxDatabases: 0,
    allowedNodeIds: [] as string[],
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(host: { id: string; name: string; type: DatabaseEngineType; host: string; port: number; username: string; ssl: boolean; maxDatabases: number; allowedNodeIds: string | null }) {
    setEditingId(host.id);
    let allowedNodeIds: string[] = [];
    try {
      allowedNodeIds = host.allowedNodeIds ? (JSON.parse(host.allowedNodeIds) as string[]) : [];
    } catch { /* leave empty */ }
    setForm({
      name: host.name,
      type: host.type,
      host: host.host,
      port: host.port,
      username: host.username,
      password: "",
      ssl: host.ssl,
      maxDatabases: host.maxDatabases,
      allowedNodeIds,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) return;
    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        ...form,
        password: form.password.trim() ? form.password : undefined,
      });
    } else {
      if (!form.password.trim()) return;
      await createMutation.mutateAsync(form);
    }
    closeForm();
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const result = await testMutation.mutateAsync({ id });
      setTestResults((r) => ({ ...r, [id]: result }));
    } catch (err) {
      setTestResults((r) => ({ ...r, [id]: { ok: false, error: String(err) } }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <>
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editTitle") : t("dialogTitle")}</DialogTitle>
            <DialogDescription>{editingId ? t("editDesc") : t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("nameLabel")} <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={t("namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("typeLabel")}</label>
                <Select
                  value={form.type}
                  onValueChange={(v) => {
                    const type = (v ?? "mysql") as DatabaseEngineType;
                    setForm((f) => ({ ...f, type, port: defaultPorts[type] }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{tt(form.type)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {databaseEngineTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {tt(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.type === "redis" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("typeRedisHint")}</p>
                )}
                {form.type === "postgresql" && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">{t("sslLabel")}</p>
                      <p className="text-[11px] text-muted-foreground/70">{t("sslHint")}</p>
                    </div>
                    <Switch
                      checked={form.ssl}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, ssl: v }))}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("hostLabel")} <span className="text-destructive">*</span></label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={t("hostPlaceholder")}
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("portLabel")}</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("usernameLabel")} <span className="text-destructive">*</span></label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={t("usernamePlaceholder")}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("passwordLabel")} {!editingId && <span className="text-destructive">*</span>}
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={editingId ? t("passwordUnchangedPlaceholder") : "••••••••"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("maxDatabasesLabel")} <span className="text-muted-foreground font-normal">{t("maxDatabasesHint")}</span></label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  value={form.maxDatabases}
                  onChange={(e) => setForm((f) => ({ ...f, maxDatabases: Number(e.target.value) }))}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("allowedNodesLabel")} <span className="text-muted-foreground font-normal">{t("allowedNodesHint")}</span>
                </label>
                {!nodes?.length ? (
                  <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{t("noNodesConfigured")}</p>
                ) : (
                  <GroupedMultiSelect
                    value={form.allowedNodeIds}
                    onChange={(allowedNodeIds) => setForm((f) => ({ ...f, allowedNodeIds }))}
                    groups={nodeGroups}
                    placeholder={t("allowedNodesPlaceholder")}
                    searchPlaceholder={t("allowedNodesSearchPlaceholder")}
                    noResultsText={t("noNodesFound")}
                  />
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                !form.name.trim() ||
                !form.host.trim() ||
                !form.username.trim() ||
                (!editingId && !form.password.trim()) ||
                createMutation.isPending ||
                updateMutation.isPending
              }
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending || updateMutation.isPending
                ? tc("saving")
                : editingId
                  ? tc("save")
                  : t("newHost")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newHost")}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_1fr_90px_40px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("typeColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("connectionColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("statusColumn")}</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{tc("loading")}</div>
          )}
          {hosts?.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}
          {hosts?.map((host, i) => {
            const result = testResults[host.id];
            const actions: ActionItem[] = [
              {
                label: tc("edit"),
                icon: Pencil,
                onClick: () => openEdit(host),
              },
              {
                label: testingId === host.id ? tc("testing") : tc("test"),
                icon: RefreshCw,
                onClick: () => void handleTest(host.id),
              },
              ...(result ? [{ label: t("viewTestResult"), icon: Eye, onClick: () => setDetailFor(host.id) } as ActionItem] : []),
              "separator",
              {
                label: tc("delete"),
                icon: Trash2,
                onClick: () => setConfirmDelete(host.id),
                destructive: true,
              },
            ];

            return (
              <div
                key={host.id}
                className={`grid grid-cols-[1fr_100px_1fr_90px_40px] items-center px-4 py-3 hover:bg-muted/40 transition-colors ${i < (hosts.length - 1) ? "border-b border-border" : ""}`}
              >
                <span className="text-sm font-medium text-foreground">{host.name}</span>
                <span className="text-xs text-muted-foreground">{tt(host.type)}</span>
                <div className="flex flex-col gap-0.5 pr-4">
                  <span className="font-mono text-xs text-foreground">{host.host}:{host.port}</span>
                  <span className="text-[11px] text-muted-foreground/70">
                    {host.username}
                    {" · "}
                    {(() => {
                      let nodeIds: string[] = [];
                      try {
                        nodeIds = host.allowedNodeIds ? (JSON.parse(host.allowedNodeIds) as string[]) : [];
                      } catch { /* treat as unrestricted */ }
                      return nodeIds.length === 0 ? t("allNodes") : t("nodeCount", { count: nodeIds.length });
                    })()}
                  </span>
                </div>
                <span>
                  {result ? (
                    <button
                      type="button"
                      onClick={() => setDetailFor(host.id)}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 ${result.ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}
                    >
                      {result.ok ? t("ok") : t("failed")}
                    </button>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {t("unknown")}
                    </span>
                  )}
                </span>
                <div className="flex items-center justify-end">
                  <RowMenu items={actions} />
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <Dialog open={!!detailFor} onOpenChange={(open) => { if (!open) setDetailFor(null); }}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("testResultTitle")}</DialogTitle>
            <DialogDescription>
              {detailFor && (testResults[detailFor]?.ok ? t("testResultOkDesc") : t("testResultFailedDesc"))}
            </DialogDescription>
          </DialogHeader>
          {detailFor && !testResults[detailFor]?.ok && (
            <div className="px-5 py-3">
              <p className="mb-1.5 text-xs font-medium text-foreground">{t("errorDetailsLabel")}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-destructive">
                {testResults[detailFor]?.error ?? t("noErrorDetails")}
              </pre>
            </div>
          )}
        </DialogPopup>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("deleteTitle")}
        description={t("deleteDesc")}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteMutation.mutateAsync({ id: confirmDelete });
          setConfirmDelete(null);
        }}
      />
    </>
  );
}
