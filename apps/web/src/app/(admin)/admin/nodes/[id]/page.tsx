"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Plus, Trash2, Copy, RefreshCw, ChevronRight } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateNode(id: string) {
  void queryClient.invalidateQueries(orpc.nodes.get.queryOptions({ input: { id } }));
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
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
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Node not found.
      </div>
    );
  }

  const allocations = node.allocations ?? [];
  const freeAllocations = allocations.filter((a) => !a.serverId);
  const usedAllocations = allocations.filter((a) => a.serverId);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2 text-sm">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Link href={"/admin/nodes" as never} className="text-muted-foreground transition-colors hover:text-foreground">
            Nodes
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          <Server className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{node.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => testConnMutation.mutate({ id })}
            disabled={testConnMutation.isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            {testConnMutation.isPending ? "Testing..." : "Test Connection"}
          </button>
          {testConnMutation.isSuccess && (
            <span className={`text-xs font-medium ${testConnMutation.data.online ? "text-green-500" : "text-destructive"}`}>
              {testConnMutation.data.online ? "Connected" : "Offline"}
            </span>
          )}
          {testConnMutation.isError && (
            <span className="text-xs font-medium text-destructive">Failed</span>
          )}
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            {showConfig ? "Hide Config" : "Wings Config"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {showConfig && deployConfig?.yaml && (
          <div className="mb-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Wings config.yml</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyConfig}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  {copiedConfig ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => regenTokenMutation.mutate({ id })}
                  disabled={regenTokenMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regen Token
                </button>
              </div>
            </div>
            <pre className="overflow-x-auto bg-[#0f0f0f] p-4 font-mono text-xs text-green-400">
              {deployConfig.yaml}
            </pre>
          </div>
        )}

        <div className="mb-4 grid grid-cols-4 gap-3">
          <InfoCard label="FQDN" value={node.fqdn} />
          <InfoCard label="Daemon Port" value={node.daemonListen} />
          <InfoCard label="Memory" value={`${node.memory} MB${node.memoryOverallocate > 0 ? ` (+${node.memoryOverallocate}%)` : ""}`} />
          <InfoCard label="Disk" value={`${node.disk} MB${node.diskOverallocate > 0 ? ` (+${node.diskOverallocate}%)` : ""}`} />
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-foreground">Allocations</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {allocations.length} total
              </span>
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                {freeAllocations.length} free
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {usedAllocations.length} used
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAddingAlloc(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
            >
              <Plus className="h-3 w-3" />
              Add Allocation
            </button>
          </div>

          {addingAlloc && (
            <div className="border-b border-border bg-muted/20 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">IP Address <span className="text-destructive">*</span></label>
                  <input
                    className={inputClass()}
                    placeholder="0.0.0.0"
                    value={allocForm.ip}
                    onChange={(e) => setAllocForm((f) => ({ ...f, ip: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Ports (range or comma-separated) <span className="text-destructive">*</span></label>
                  <input
                    className={inputClass()}
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
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {addAllocMutation.isPending ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingAlloc(false)}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            {allocations.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No allocations. Add some to create servers on this node.
              </div>
            )}
            {allocations.map((alloc) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: alloc.serverId ? "rgb(var(--muted-foreground) / 0.4)" : "#22c55e" }}
                  />
                  <span className="text-sm text-foreground">
                    {alloc.ip}:{alloc.port}
                  </span>
                  {alloc.ipAlias && (
                    <span className="text-xs text-muted-foreground">{alloc.ipAlias}</span>
                  )}
                  {alloc.serverId && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      assigned
                    </span>
                  )}
                </div>
                {!alloc.serverId && (
                  confirmDelete === alloc.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteAllocMutation.mutateAsync({ id: alloc.id });
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
                      onClick={() => setConfirmDelete(alloc.id)}
                      className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
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
