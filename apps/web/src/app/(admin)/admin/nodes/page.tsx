"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Server, Plus, ChevronDown, Trash2, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.nodes.key() });
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

export default function NodesPage() {
  const { data: nodes, isLoading } = useQuery(orpc.nodes.list.queryOptions());
  const { data: locations } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.nodes.create.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.nodes.delete.mutationOptions({ onSuccess: invalidate }));

  const [search, setSearch] = useState("");
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = (nodes ?? []).filter((n) => {
    const q = search.toLowerCase();
    return n.name.toLowerCase().includes(q) || n.fqdn.toLowerCase().includes(q);
  });

  async function handleCreate() {
    if (!form.name.trim() || !form.locationId || !form.fqdn.trim()) return;
    await createMutation.mutateAsync(form);
    setAdding(false);
  }

  function nodeActions(node: { id: string; name: string }): ActionItem[] {
    return [
      {
        label: "Delete",
        icon: Trash2,
        onClick: () => setConfirmDelete(node.id),
        destructive: true,
      },
    ];
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Nodes</span>
          {nodes && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {nodes.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            New Node
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {adding && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-medium text-muted-foreground">New Node</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className={inputClass()}
                  placeholder="Node 01"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Location <span className="text-destructive">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span className={form.locationId ? "text-foreground" : "text-muted-foreground/50"}>
                      {form.locationId
                        ? (locations?.find((l) => l.id === form.locationId)?.name ?? "Select...")
                        : "Select location..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg">
                    {locations?.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        onClick={() => setForm((f) => ({ ...f, locationId: l.id }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.locationId === l.id ? "bg-green-500" : "bg-transparent"}`} />
                        {l.name} <span className="text-muted-foreground/50">({l.short})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">FQDN <span className="text-destructive">*</span></label>
                <input
                  className={inputClass()}
                  placeholder="node01.example.com"
                  value={form.fqdn}
                  onChange={(e) => setForm((f) => ({ ...f, fqdn: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Scheme</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span>{form.scheme.toUpperCase()}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg">
                    {(["https", "http"] as const).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setForm((f) => ({ ...f, scheme: s }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.scheme === s ? "bg-green-500" : "bg-transparent"}`} />
                        {s.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Memory (MB)</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.memory}
                  onChange={(e) => setForm((f) => ({ ...f, memory: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Disk (MB)</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.disk}
                  onChange={(e) => setForm((f) => ({ ...f, disk: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Daemon Port</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={form.daemonListen}
                  onChange={(e) => setForm((f) => ({ ...f, daemonListen: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">SFTP Port</label>
                <input
                  type="number"
                  className={inputClass()}
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

        <ConfirmDialog
          open={confirmDelete !== null}
          onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
          title="Delete node?"
          description="This will remove all associated data."
          confirmLabel="Delete"
          destructive
          loading={deleteMutation.isPending}
          onConfirm={async () => {
            if (!confirmDelete) return;
            await deleteMutation.mutateAsync({ id: confirmDelete });
            setConfirmDelete(null);
          }}
        />

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_200px_160px_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <span className="text-xs font-medium text-muted-foreground">Address</span>
            <span className="text-xs font-medium text-muted-foreground">Resources</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? "No nodes match your search." : "No nodes yet. Create one to start deploying servers."}
            </div>
          )}
          {filtered.map((node, i) => {
            const actions = nodeActions(node);
            const isLast = i === filtered.length - 1;
            return (
              <ContextMenu key={node.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className={`grid grid-cols-[24px_1fr_200px_160px_48px] items-center px-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: node.maintenanceMode ? "rgb(var(--muted-foreground) / 0.4)" : "#22c55e" }}
                    />
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/nodes/${node.id}` as never}
                        className="text-sm font-medium text-foreground transition-colors hover:text-green-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {node.name}
                      </Link>
                      {node.maintenanceMode && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Maintenance
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {node.fqdn}:{node.daemonListen}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(node.memory / 1024).toFixed(1)} GB · {(node.disk / 1024).toFixed(1)} GB
                    </span>
                    <div className="flex items-center justify-end">
                      <RowMenu items={actions} />
                    </div>
                  </div>
                )}
              </ContextMenu>
            );
          })}
        </div>
      </div>
    </>
  );
}
