"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { MapPin, Trash2, Plus } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.locations.key() });
}

export default function LocationsPage() {
  const { data: locations, isLoading } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.locations.create.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.locations.delete.mutationOptions({ onSuccess: invalidate }));

  const [form, setForm] = useState({ name: "", short: "", long: "" });
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.name.trim() || !form.short.trim()) return;
    await createMutation.mutateAsync(form);
    setForm({ name: "", short: "", long: "" });
    setAdding(false);
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
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" />
          New Location
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {adding && (
          <div className="border-b border-[#222222] bg-[#141414] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">New Location</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Name *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="US East"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Short Code *</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="us-east"
                  value={form.short}
                  onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Description</label>
                <input
                  className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Optional description"
                  value={form.long}
                  onChange={(e) => setForm((f) => ({ ...f, long: e.target.value }))}
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
          {locations?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No locations yet.
            </div>
          )}
          {locations?.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-[#f59e0b]">{loc.short}</span>
                <span className="text-sm text-white">{loc.name}</span>
                {loc.long && <span className="text-xs text-[#555555]">{loc.long}</span>}
              </div>
              <div className="flex items-center gap-2">
                {confirmDelete === loc.id ? (
                  <>
                    <span className="text-xs text-[#f43f5e]">Delete?</span>
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
                      className="bg-neutral-700 px-3 py-1 text-xs font-medium text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(loc.id)}
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
