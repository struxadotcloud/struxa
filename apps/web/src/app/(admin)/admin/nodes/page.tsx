"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Plus, ExternalLink } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.nodes.key() });
}

export default function NodesPage() {
  const { data: nodes, isLoading } = useQuery(orpc.nodes.list.queryOptions());
  const { data: locations } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.nodes.create.mutationOptions({ onSuccess: invalidate }));

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    locationId: "",
    fqdn: "",
    scheme: "https" as "https" | "http",
    memory: 4096,
    memoryOverallocate: 0,
    disk: 51200,
    diskOverallocate: 0,
    daemonListen: 8080,
    daemonSFTP: 2022,
    uploadSize: 100,
  });

  async function handleCreate() {
    if (!form.name.trim() || !form.locationId || !form.fqdn.trim()) return;
    await createMutation.mutateAsync(form);
    setAdding(false);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Server className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Nodes</span>
          {nodes && (
            <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
              {nodes.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Node
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {adding && (
          <div className="border-b border-[#222222] bg-[#141414] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">New Node</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Name *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Node 01"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Location *</label>
                <select
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.locationId}
                  onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                >
                  <option value="">Select location...</option>
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.short})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">FQDN *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="node01.example.com"
                  value={form.fqdn}
                  onChange={(e) => setForm((f) => ({ ...f, fqdn: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Scheme</label>
                <select
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.scheme}
                  onChange={(e) => setForm((f) => ({ ...f, scheme: e.target.value as "https" | "http" }))}
                >
                  <option value="https">HTTPS</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Memory (MB)</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.memory}
                  onChange={(e) => setForm((f) => ({ ...f, memory: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Disk (MB)</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.disk}
                  onChange={(e) => setForm((f) => ({ ...f, disk: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Daemon Port</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.daemonListen}
                  onChange={(e) => setForm((f) => ({ ...f, daemonListen: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">SFTP Port</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={form.daemonSFTP}
                  onChange={(e) => setForm((f) => ({ ...f, daemonSFTP: Number(e.target.value) }))}
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
                className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 border-l border-t border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              Loading...
            </div>
          )}
          {nodes?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No nodes yet.
            </div>
          )}
          {nodes?.map((node) => (
            <Link
              key={node.id}
              href={`/admin/nodes/${node.id}` as never}
              className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
            >
              <div className="flex items-center gap-4">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: node.maintenanceMode ? "#f59e0b" : "#22c55e" }}
                />
                <span className="text-sm font-medium text-white">{node.name}</span>
                <span className="font-mono text-xs text-[#555555]">
                  {node.fqdn}:{node.daemonListen}
                </span>
                <span className="text-xs text-[#444444]">
                  {(node.memory / 1024).toFixed(1)} GB RAM · {(node.disk / 1024).toFixed(1)} GB Disk
                </span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-[#444444]" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
