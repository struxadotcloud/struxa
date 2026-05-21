"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Search, ChevronRight } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

function invalidateNests() {
  void queryClient.invalidateQueries(orpc.nests.list.queryOptions());
}

function invalidateEggs(nestId: string) {
  void queryClient.invalidateQueries(orpc.eggs.listByNest.queryOptions({ input: { nestId } }));
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
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

  const [search, setSearch] = useState("");
  const [nestName, setNestName] = useState("");
  const [nestAuthor, setNestAuthor] = useState("");
  const [nestDescription, setNestDescription] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = (eggs ?? []).filter((e) => {
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q);
  });

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
        label: "Delete",
        icon: Trash2,
        onClick: () => setConfirmDelete(egg.id),
        destructive: true,
      },
    ];
  }

  return (
    <>
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete egg?"
        description="This will permanently remove the egg and all its variables."
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
        <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
              <Link href={"/admin/nests" as never} className="text-muted-foreground transition-colors hover:text-foreground">
              Nests
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="font-medium text-foreground">{nest?.name ?? nestId}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON
          </button>
        </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Nest Settings</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Name</label>
                  <input className={inputClass()} value={nestName} onChange={(e) => setNestName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Author</label>
                  <input className={inputClass()} value={nestAuthor} onChange={(e) => setNestAuthor(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <input className={inputClass()} value={nestDescription} onChange={(e) => setNestDescription(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNest}
                  disabled={updateNestMutation.isPending}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {updateNestMutation.isPending ? "Saving..." : "Save"}
                </button>
                {updateNestMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved</span>}
                {updateNestMutation.isError && <span className="text-xs text-destructive">{updateNestMutation.error.message}</span>}
              </div>
            </div>
          </div>

          {showImport && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Import Pterodactyl Egg JSON</h2>
              </div>
              <div className="p-4">
                <textarea
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
                    className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {importMutation.isPending ? "Importing..." : "Import"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImport(false)}
                    className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  {importMutation.isError && (
                    <span className="text-xs text-destructive">{importMutation.error.message}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">Eggs</span>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
                  <input
                    className="rounded-lg border border-border bg-background py-1 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                    placeholder="Search eggs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Import
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search ? "No eggs match your search." : "No eggs yet. Import a Pterodactyl egg JSON to get started."}
              </div>
            )}
            {filtered.map((egg, i) => {
              const actions = eggActions(egg);
              const isLast = i === filtered.length - 1;
              return (
                <ContextMenu key={egg.id} items={actions}>
                  {({ onContextMenu }) => (
                    <div
                      onContextMenu={onContextMenu}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Link
                          href={`/admin/nests/${nestId}/eggs/${egg.id}` as never}
                          className="flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-green-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {egg.name}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </Link>
                        {egg.description && (
                          <span className="max-w-sm truncate text-xs text-muted-foreground">{egg.description}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                          {egg.startup}
                        </span>
                        <RowMenu items={actions} />
                      </div>
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
