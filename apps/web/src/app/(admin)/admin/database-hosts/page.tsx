"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Database, Plus, Trash2 } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.databaseHosts.key() });
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

export default function DatabaseHostsPage() {
  const { data: hosts, isLoading } = useQuery(orpc.databaseHosts.list.queryOptions());
  const createMutation = useMutation(orpc.databaseHosts.create.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.databaseHosts.delete.mutationOptions({ onSuccess: invalidate }));
  const testMutation = useMutation(orpc.databaseHosts.testConnection.mutationOptions());

  const [adding, setAdding] = useState(false);
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

  async function handleCreate() {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim()) return;
    await createMutation.mutateAsync(form);
    setForm({ name: "", host: "", port: 3306, username: "", password: "", maxDatabases: 0 });
    setAdding(false);
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Database Hosts</span>
          {hosts && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {hosts.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Host
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {adding && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-medium text-muted-foreground">New Database Host</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                <input className={inputClass()} placeholder="Primary MySQL" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Host <span className="text-destructive">*</span></label>
                <input className={inputClass()} placeholder="127.0.0.1" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Port</label>
                <input type="number" className={inputClass()} value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Username <span className="text-destructive">*</span></label>
                <input className={inputClass()} placeholder="root" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Password <span className="text-destructive">*</span></label>
                <input type="password" className={inputClass()} placeholder="••••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Max Databases <span className="text-muted-foreground font-normal">(0 = unlimited)</span></label>
                <input type="number" className={inputClass()} value={form.maxDatabases} onChange={(e) => setForm((f) => ({ ...f, maxDatabases: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_220px_80px_80px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <span className="text-xs font-medium text-muted-foreground">Connection</span>
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {hosts?.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No database hosts configured.
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
                    {testResults[host.id] ? "OK" : "Failed"}
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
                  Test
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
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Cancel
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
    </>
  );
}
