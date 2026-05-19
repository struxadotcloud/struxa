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
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[#555555]" />
            <input
              className="border border-[#333333] bg-[#0a0a0a] py-1.5 pl-8 pr-3 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
          >
            <Plus className="h-3.5 w-3.5" />
            New Node
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {adding && (
          <div className="border-b border-[#222222] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">New Node</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Name *</label>
                <input
                  autoFocus
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Node 01"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Location *</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                    <span className={form.locationId ? "text-white" : "text-[#444444]"}>
                      {form.locationId
                        ? (locations?.find((l) => l.id === form.locationId)?.name ?? "Select...")
                        : "Select location..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                    {locations?.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        onClick={() => setForm((f) => ({ ...f, locationId: l.id }))}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.locationId === l.id ? "bg-[#22c55e]" : "bg-transparent"}`} />
                        {l.name} <span className="text-[#444444]">({l.short})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                    <span>{form.scheme.toUpperCase()}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                    {(["https", "http"] as const).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setForm((f) => ({ ...f, scheme: s }))}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.scheme === s ? "bg-[#22c55e]" : "bg-transparent"}`} />
                        {s.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
                className="bg-neutral-800 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
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

        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              {search ? "No nodes match your search." : "No nodes yet. Create one to start deploying servers."}
            </div>
          )}
          {filtered.map((node) => {
            const actions = nodeActions(node);
            return (
              <ContextMenu key={node.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: node.maintenanceMode ? "#888888" : "#22c55e" }}
                      />
                      <Link
                        href={`/admin/nodes/${node.id}` as never}
                        className="text-sm font-medium text-white transition-colors hover:text-[#22c55e]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {node.name}
                      </Link>
                      <span className="font-mono text-xs text-[#555555]">
                        {node.fqdn}:{node.daemonListen}
                      </span>
                      <span className="text-xs text-[#444444]">
                        {(node.memory / 1024).toFixed(1)} GB · {(node.disk / 1024).toFixed(1)} GB disk
                      </span>
                      {node.maintenanceMode && (
                        <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
                          Maintenance
                        </span>
                      )}
                    </div>
                    <RowMenu items={actions} />
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
