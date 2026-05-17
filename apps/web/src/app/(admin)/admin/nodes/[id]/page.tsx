"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Plus, Trash2, Copy, RefreshCw } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateNode(id: string) {
  void queryClient.invalidateQueries(orpc.nodes.get.queryOptions({ input: { id } }));
}

export default function NodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: node, isLoading } = useQuery(orpc.nodes.get.queryOptions({ input: { id } }));
  const { data: deployConfig } = useQuery(orpc.nodes.getDeploymentConfig.queryOptions({ input: { id } }));

  const addAllocMutation = useMutation(
    orpc.allocations.create.mutationOptions({ onSuccess: () => invalidateNode(id) }),
  );
  const deleteAllocMutation = useMutation(
    orpc.allocations.delete.mutationOptions({ onSuccess: () => invalidateNode(id) }),
  );
  const regenTokenMutation = useMutation(
    orpc.nodes.regenerateToken.mutationOptions({ onSuccess: () => invalidateNode(id) }),
  );
  const testConnMutation = useMutation(orpc.nodes.testConnection.mutationOptions());

  const [allocForm, setAllocForm] = useState({ ip: "", ports: "" });
  const [addingAlloc, setAddingAlloc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  async function handleAddAlloc() {
    if (!allocForm.ip.trim() || !allocForm.ports.trim()) return;
    await addAllocMutation.mutateAsync({ nodeId: id, ip: allocForm.ip, ports: allocForm.ports });
    setAllocForm({ ip: "", ports: "" });
    setAddingAlloc(false);
  }

  async function handleCopyConfig() {
    if (deployConfig?.yaml) {
      await navigator.clipboard.writeText(deployConfig.yaml);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#555555]">
        Loading...
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#555555]">
        Node not found.
      </div>
    );
  }

  const allocations = node.allocations ?? [];
  const freeAllocations = allocations.filter((a) => !a.serverId);
  const usedAllocations = allocations.filter((a) => a.serverId);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href={"/admin/nodes" as never} className="text-[#555555] transition-colors hover:text-white">
            Nodes
          </Link>
          <span className="text-[#333333]">/</span>
          <Server className="h-3.5 w-3.5 text-[#555555]" />
          <span className="text-white">{node.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => testConnMutation.mutate({ id })}
            disabled={testConnMutation.isPending}
            className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {testConnMutation.isPending ? "Testing..." : "Test Connection"}
          </button>
          {testConnMutation.isSuccess && (
            <span className="text-xs text-[#22c55e]">
              {testConnMutation.data.online ? "Connected" : "Offline"}
            </span>
          )}
          {testConnMutation.isError && (
            <span className="text-xs text-[#f43f5e]">Failed</span>
          )}
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            {showConfig ? "Hide Config" : "Wings Config"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {showConfig && deployConfig?.yaml && (
          <div className="border-b border-[#222222] bg-[#141414] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-[#555555]">Wings config.yml</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyConfig}
                  className="flex items-center gap-1 text-xs text-[#555555] transition-colors hover:text-white"
                >
                  <Copy className="h-3 w-3" />
                  {copiedConfig ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => regenTokenMutation.mutate({ id })}
                  disabled={regenTokenMutation.isPending}
                  className="flex items-center gap-1 text-xs text-[#f59e0b] transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regen Token
                </button>
              </div>
            </div>
            <pre className="overflow-x-auto border border-[#222222] bg-[#0a0a0a] p-3 font-mono text-xs text-[#22c55e]">
              {deployConfig.yaml}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-2 border-l border-[#222222]">
          <div className="flex flex-col gap-1 border-r border-b border-[#222222] p-4">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">FQDN</span>
            <span className="font-mono text-sm text-white">{node.fqdn}</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-b border-[#222222] p-4">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">Daemon Port</span>
            <span className="font-mono text-sm text-white">{node.daemonListen}</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-b border-[#222222] p-4">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">Memory</span>
            <span className="font-mono text-sm text-white">
              {node.memory} MB
              {node.memoryOverallocate > 0 && (
                <span className="text-[#555555]"> (+{node.memoryOverallocate}% overallocate)</span>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-r border-b border-[#222222] p-4">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">Disk</span>
            <span className="font-mono text-sm text-white">
              {node.disk} MB
              {node.diskOverallocate > 0 && (
                <span className="text-[#555555]"> (+{node.diskOverallocate}% overallocate)</span>
              )}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white">Allocations</span>
              <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
                {allocations.length} total
              </span>
              <span className="border border-[#22c55e]/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#22c55e]">
                {freeAllocations.length} free
              </span>
              <span className="border border-[#555555]/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
                {usedAllocations.length} used
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAddingAlloc(true)}
              className="flex items-center gap-1.5 bg-white px-3 py-1 text-xs font-medium text-black transition-opacity hover:opacity-80"
            >
              <Plus className="h-3 w-3" />
              Add Allocation
            </button>
          </div>

          {addingAlloc && (
            <div className="border-b border-[#222222] bg-[#141414] p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">IP Address *</label>
                  <input
                    className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                    placeholder="0.0.0.0"
                    value={allocForm.ip}
                    onChange={(e) => setAllocForm((f) => ({ ...f, ip: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                    Ports (range or comma-separated) *
                  </label>
                  <input
                    className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                    placeholder="25565-25600 or 25565,25566"
                    value={allocForm.ports}
                    onChange={(e) => setAllocForm((f) => ({ ...f, ports: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleAddAlloc}
                  disabled={addAllocMutation.isPending}
                  className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {addAllocMutation.isPending ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingAlloc(false)}
                  className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 border-l border-[#222222]">
            {allocations.length === 0 && (
              <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
                No allocations. Add some to create servers on this node.
              </div>
            )}
            {allocations.map((alloc) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-2.5 hover:bg-[#111111]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: alloc.serverId ? "#555555" : "#22c55e" }}
                  />
                  <span className="font-mono text-sm text-white">
                    {alloc.ip}:{alloc.port}
                  </span>
                  {alloc.ipAlias && (
                    <span className="font-mono text-xs text-[#555555]">{alloc.ipAlias}</span>
                  )}
                  {alloc.serverId && (
                    <span className="text-xs text-[#555555]">assigned</span>
                  )}
                </div>
                {!alloc.serverId && (
                  confirmDelete === alloc.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteAllocMutation.mutateAsync({ id: alloc.id });
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
                      onClick={() => setConfirmDelete(alloc.id)}
                      className="text-[#555555] transition-colors hover:text-[#f43f5e]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
