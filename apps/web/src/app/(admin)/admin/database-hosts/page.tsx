"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Database, Plus, Trash2 } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.databaseHosts.key() });
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Database className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Database Hosts</span>
          {hosts && (
            <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
              {hosts.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Host
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {adding && (
          <div className="border-b border-[#222222] bg-[#141414] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">New Database Host</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Name *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Primary MySQL"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Host *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="127.0.0.1"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Port</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Username *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="root"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Password *</label>
                <input
                  type="password"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                  Max Databases (0 = unlimited)
                </label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.maxDatabases}
                  onChange={(e) => setForm((f) => ({ ...f, maxDatabases: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              Loading...
            </div>
          )}
          {hosts?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No database hosts configured.
            </div>
          )}
          {hosts?.map((host) => (
            <div
              key={host.id}
              className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
            >
              <div className="flex items-center gap-4">
                {testResults[host.id] !== undefined && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: testResults[host.id] ? "#22c55e" : "#f43f5e" }}
                  />
                )}
                <span className="text-sm font-medium text-white">{host.name}</span>
                <span className="font-mono text-xs text-[#555555]">
                  {host.username}@{host.host}:{host.port}
                </span>
                {host.maxDatabases > 0 && (
                  <span className="text-xs text-[#444444]">max {host.maxDatabases} DBs</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTest(host.id)}
                  disabled={testMutation.isPending}
                  className="text-xs text-[#555555] transition-colors hover:text-white disabled:opacity-40"
                >
                  Test
                </button>
                {confirmDelete === host.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteMutation.mutateAsync({ id: host.id });
                        setConfirmDelete(null);
                      }}
                      className="bg-[#f43f5e] px-3 py-1 text-xs font-medium text-white"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="bg-neutral-700 px-3 py-1 text-xs font-medium text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(host.id)}
                    className="text-[#555555] transition-colors hover:text-[#f43f5e]"
                  >
                    <Trash2 className="h-4 w-4" />
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
