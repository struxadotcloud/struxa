"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Package, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";

function invalidateNests() {
  void queryClient.invalidateQueries(orpc.nests.list.queryOptions());
}

function invalidateEggs(nestId: string) {
  void queryClient.invalidateQueries(orpc.eggs.listByNest.queryOptions({ input: { nestId } }));
}

export default function NestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: nestId } = use(params);
  const { data: nests } = useQuery(orpc.nests.list.queryOptions());
  const { data: eggs, isLoading } = useQuery(
    orpc.eggs.listByNest.queryOptions({ input: { nestId } }),
  );

  const nest = nests?.find((n) => n.id === nestId);

  const updateNestMutation = useMutation(
    orpc.nests.update.mutationOptions({ onSuccess: invalidateNests }),
  );
  const importMutation = useMutation(
    orpc.eggs.importJson.mutationOptions({ onSuccess: () => invalidateEggs(nestId) }),
  );
  const deleteMutation = useMutation(
    orpc.eggs.delete.mutationOptions({ onSuccess: () => invalidateEggs(nestId) }),
  );

  const [nestName, setNestName] = useState("");
  const [nestAuthor, setNestAuthor] = useState("");
  const [nestDescription, setNestDescription] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (nest) {
      setNestName(nest.name);
      setNestAuthor(nest.author ?? "");
      setNestDescription(nest.description ?? "");
    }
  }, [nest]);

  async function handleImport() {
    if (!importJson.trim()) return;
    await importMutation.mutateAsync({ nestId, json: importJson });
    setImportJson("");
    setShowImport(false);
  }

  async function handleSaveNest() {
    await updateNestMutation.mutateAsync({
      id: nestId,
      name: nestName,
      author: nestAuthor,
      description: nestDescription,
    });
  }

  function eggActions(egg: { id: string; name: string }): ActionItem[] {
    return [
      {
        label: "Edit Egg",
        icon: Pencil,
        onClick: () => { window.location.href = `/admin/nests/${nestId}/eggs/${egg.id}`; },
      },
      "separator",
      {
        label: "Delete",
        icon: Trash2,
        onClick: () => setConfirmDelete(egg.id),
        destructive: true,
      },
    ];
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href={"/admin/nests" as never} className="text-[#555555] transition-colors hover:text-white">
            Nests
          </Link>
          <span className="text-[#333333]">/</span>
          <Package className="h-3.5 w-3.5 text-[#555555]" />
          <span className="text-white">{nest?.name ?? nestId}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="flex items-center gap-1.5 bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          <Upload className="h-3.5 w-3.5" />
          Import JSON
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Nest settings */}
        <div className="border-b border-[#222222] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">Nest Settings</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Name</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={nestName}
                onChange={(e) => setNestName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Author</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={nestAuthor}
                onChange={(e) => setNestAuthor(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Description</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={nestDescription}
                onChange={(e) => setNestDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveNest}
              disabled={updateNestMutation.isPending}
              className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {updateNestMutation.isPending ? "Saving..." : "Save"}
            </button>
            {updateNestMutation.isSuccess && <span className="text-xs text-[#22c55e]">Saved</span>}
            {updateNestMutation.isError && (
              <span className="text-xs text-[#f43f5e]">{updateNestMutation.error.message}</span>
            )}
          </div>
        </div>

        {/* Import JSON */}
        {showImport && (
          <div className="border-b border-[#222222] p-4">
            <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">
              Import Pterodactyl Egg JSON
            </p>
            <textarea
              autoFocus
              className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
              rows={10}
              placeholder='Paste egg JSON here ({"name": "...", "startup": "...", ...})'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {importMutation.isPending ? "Importing..." : "Import"}
              </button>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="bg-neutral-800 px-4 py-1.5 text-sm font-medium text-white"
              >
                Cancel
              </button>
              {importMutation.isError && (
                <span className="text-xs text-[#f43f5e]">{importMutation.error.message}</span>
              )}
            </div>
          </div>
        )}

        {/* Delete confirm bar */}
        {confirmDelete && (
          <div className="flex items-center gap-3 border-b border-[#222222] px-4 py-3">
            <span className="text-sm text-[#f43f5e]">Delete egg?</span>
            <button
              type="button"
              onClick={async () => {
                await deleteMutation.mutateAsync({ id: confirmDelete });
                setConfirmDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="bg-[#f43f5e] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="bg-neutral-800 px-3 py-1 text-xs font-medium text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Eggs list */}
        <div className="grid grid-cols-1 border-l border-[#222222]">
          <div className="flex items-center justify-between border-r border-b border-[#222222] bg-[#0d0d0d] px-4 py-2">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">Eggs</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#444444]">{eggs?.length ?? 0}</span>
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1 text-[10px] text-[#555555] transition-colors hover:text-white"
              >
                <Plus className="h-3 w-3" />
                Import
              </button>
            </div>
          </div>
          {isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">Loading...</div>
          )}
          {eggs?.length === 0 && !isLoading && (
            <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
              No eggs yet. Import a Pterodactyl egg JSON to get started.
            </div>
          )}
          {eggs?.map((egg) => {
            const actions = eggActions(egg);
            return (
              <ContextMenu key={egg.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className="flex items-center justify-between border-r border-b border-[#222222] px-4 py-3 hover:bg-[#111111]"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="text-sm font-medium text-white">{egg.name}</span>
                      {egg.description && (
                        <span className="max-w-sm truncate text-xs text-[#555555]">{egg.description}</span>
                      )}
                      <span className="shrink-0 border border-[#333333] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#444444]">
                        {egg.variables.length} vars
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="max-w-[200px] truncate font-mono text-xs text-[#444444]">
                        {egg.startup}
                      </span>
                      <Link
                        href={`/admin/nests/${nestId}/eggs/${egg.id}` as never}
                        className="text-[#555555] transition-colors hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                        title="Edit egg"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
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
