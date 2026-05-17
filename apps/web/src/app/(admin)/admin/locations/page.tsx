"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { MapPin, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.locations.key() });
}

export default function LocationsPage() {
  const { data: locations, isLoading } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.locations.create.mutationOptions({ onSuccess: invalidate }));
  const updateMutation = useMutation(orpc.locations.update.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.locations.delete.mutationOptions({ onSuccess: invalidate }));

  const [form, setForm] = useState({ name: "", short: "", long: "" });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", short: "", long: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function startEdit(loc: { id: string; name: string; short: string; long: string | null }) {
    setEditingId(loc.id);
    setEditForm({ name: loc.name, short: loc.short, long: loc.long ?? "" });
    setConfirmDelete(null);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.short.trim()) return;
    await createMutation.mutateAsync(form);
    setForm({ name: "", short: "", long: "" });
    setAdding(false);
  }

  async function handleUpdate() {
    if (!editingId || !editForm.name.trim() || !editForm.short.trim()) return;
    await updateMutation.mutateAsync({ id: editingId, ...editForm });
    setEditingId(null);
  }

  function rowActions(loc: { id: string; name: string; short: string; long: string | null }): ActionItem[] {
    return [
      { label: "Edit", icon: Pencil, onClick: () => startEdit(loc) },
      "separator",
      { label: "Delete", icon: Trash2, onClick: () => setConfirmDelete(loc.id), destructive: true },
    ];
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <MapPin className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Locations</span>
          {locations && (
            <span className="border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#555555]">
              {locations.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Location
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {adding && (
          <div className="border-b border-[#222222] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">New Location</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Name *</label>
                <input
                  autoFocus
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="US East"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setAdding(false); }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Short Code *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="us-east"
                  value={form.short}
                  onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setAdding(false); }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Description</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Optional description"
                  value={form.long}
                  onChange={(e) => setForm((f) => ({ ...f, long: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setAdding(false); }}
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

        <div className="grid grid-cols-1 border-l border-[#222222]">
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">Loading...</div>
          )}
          {locations?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No locations yet. Create one to start adding nodes.
            </div>
          )}
          {locations?.map((loc) =>
            editingId === loc.id ? (
              <div key={loc.id} className="grid grid-cols-[120px_1fr_1fr_auto] items-center gap-3 border-r border-b border-[#222222] px-4 py-2.5">
                <input
                  autoFocus
                  className="border border-[#555555] bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-white outline-none focus:border-white"
                  value={editForm.short}
                  onChange={(e) => setEditForm((f) => ({ ...f, short: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                />
                <input
                  className="border border-[#555555] bg-[#0a0a0a] px-2 py-1 text-sm text-white outline-none focus:border-white"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                />
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-sm text-[#888888] outline-none focus:border-[#555555]"
                  placeholder="Description"
                  value={editForm.long}
                  onChange={(e) => setEditForm((f) => ({ ...f, long: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="flex h-6 w-6 items-center justify-center text-[#22c55e] transition-opacity hover:opacity-70 disabled:opacity-40"
                    title="Save (Enter)"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-6 w-6 items-center justify-center text-[#555555] transition-colors hover:text-white"
                    title="Cancel (Esc)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <ContextMenu key={loc.id} items={rowActions(loc)}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-20 font-mono text-xs text-[#888888]">{loc.short}</span>
                      <span className="text-sm text-white">{loc.name}</span>
                      {loc.long && <span className="text-xs text-[#555555]">{loc.long}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      {confirmDelete === loc.id ? (
                        <>
                          <span className="mr-2 text-xs text-[#f43f5e]">Delete?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteMutation.mutateAsync({ id: loc.id });
                              setConfirmDelete(null);
                            }}
                            className="bg-[#f43f5e] px-3 py-1 text-xs font-medium text-white"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="ml-1 bg-neutral-800 px-3 py-1 text-xs font-medium text-white"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <RowMenu items={rowActions(loc)} />
                      )}
                    </div>
                  </div>
                )}
              </ContextMenu>
            ),
          )}
        </div>
      </div>
    </>
  );
}
