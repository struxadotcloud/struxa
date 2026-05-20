"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Check, X, Search } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.locations.key() });
}

function inputClass(small?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 ${small ? "py-1" : "py-1.5"} text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors`;
}

export default function LocationsPage() {
  const { data: locations, isLoading } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.locations.create.mutationOptions({ onSuccess: invalidate }));
  const updateMutation = useMutation(orpc.locations.update.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.locations.delete.mutationOptions({ onSuccess: invalidate }));

  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", short: "", long: "" });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", short: "", long: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = (locations ?? []).filter((l) => {
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.short.toLowerCase().includes(q);
  });

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
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete location?"
        description="This will permanently remove the location. Nodes assigned to it may be affected."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteMutation.mutateAsync({ id: confirmDelete });
          setConfirmDelete(null);
        }}
      />

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold text-foreground">Locations</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder="Search locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => { setAdding(true); setEditingId(null); }}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" />
              New Location
            </button>
          </div>
        </div>
        {adding && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-medium text-muted-foreground">New Location</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Name <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className={inputClass()}
                  placeholder="US East"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setAdding(false); }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Short Code <span className="text-destructive">*</span></label>
                <input
                  className={inputClass()}
                  placeholder="us-east"
                  value={form.short}
                  onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setAdding(false); }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <input
                  className={inputClass()}
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
          <div className="grid grid-cols-[120px_1fr_1fr_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Short</span>
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? "No locations match your search." : "No locations yet. Create one to start adding nodes."}
            </div>
          )}
          {filtered.map((loc, i) => {
            const isLast = i === filtered.length - 1;
            return editingId === loc.id ? (
              <div key={loc.id} className={`grid grid-cols-[120px_1fr_1fr_48px] items-center gap-3 px-4 py-2.5 ${!isLast ? "border-b border-border" : ""}`}>
                <input
                  autoFocus
                  className={inputClass(true)}
                  value={editForm.short}
                  onChange={(e) => setEditForm((f) => ({ ...f, short: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                />
                <input
                  className={inputClass(true)}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleUpdate(); if (e.key === "Escape") setEditingId(null); }}
                />
                <input
                  className={inputClass(true)}
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
                    className="flex h-6 w-6 items-center justify-center rounded text-green-500 hover:bg-muted transition-colors disabled:opacity-40"
                    title="Save (Enter)"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                    className={`flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-24 font-mono text-xs text-muted-foreground">{loc.short}</span>
                      <span className="text-sm font-medium text-foreground">{loc.name}</span>
                      {loc.long && <span className="text-xs text-muted-foreground">{loc.long}</span>}
                    </div>
                    <RowMenu items={rowActions(loc)} />
                  </div>
                )}
              </ContextMenu>
            );
          })}
        </div>
        </div>
      </div>
    </>
  );
}
