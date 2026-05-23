"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.databaseHosts.key() });
}

export default function DatabaseHostsPage() {
  const t = useTranslations("admin.databaseHosts");
  const tc = useTranslations("common");

  const { data: hosts, isLoading } = useQuery(orpc.databaseHosts.list.queryOptions());
  const createMutation = useMutation(orpc.databaseHosts.create.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.databaseHosts.delete.mutationOptions({ onSuccess: invalidate }));
  const testMutation = useMutation(orpc.databaseHosts.testConnection.mutationOptions());

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 3306,
    username: "",
    password: "",
    maxDatabases: 0,
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  function closeCreate() {
    setShowCreate(false);
    setForm({ name: "", host: "", port: 3306, username: "", password: "", maxDatabases: 0 });
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim()) return;
    await createMutation.mutateAsync(form);
    closeCreate();
  }

  async function handleTest(id: string) {
    try {
      const result = await testMutation.mutateAsync({ id });
      setTestResults((r) => ({ ...r, [id]: result.ok }));
    } catch {
      setTestResults((r) => ({ ...r, [id]: false }));
    }
  }

  return (
    <>
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
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
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("passwordLabel")} <span className="text-destructive">*</span></label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder="••••••••"
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
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!form.name.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? tc("creating") : t("newHost")}
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
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newHost")}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_220px_80px_80px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
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
          {hosts?.map((host, i) => (
            <div
              key={host.id}
              className={`grid grid-cols-[1fr_220px_80px_80px] items-center px-4 py-3 hover:bg-muted/40 transition-colors ${i < (hosts.length - 1) ? "border-b border-border" : ""}`}
            >
              <span className="text-sm font-medium text-foreground">{host.name}</span>
              <span className="text-xs text-muted-foreground">
                {host.username}@{host.host}:{host.port}
              </span>
              <span>
                {testResults[host.id] !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${testResults[host.id] ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}
                  >
                    {testResults[host.id] ? t("ok") : t("failed")}
                  </span>
                )}
              </span>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleTest(host.id)}
                  disabled={testMutation.isPending}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  {tc("test")}
                </button>
                {confirmDelete === host.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteMutation.mutateAsync({ id: host.id });
                        setConfirmDelete(null);
                      }}
                      className="rounded-lg bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground"
                    >
                      {tc("delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      {tc("cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(host.id)}
                    className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </>
  );
}
