"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileJson, Trash2, Search, ChevronRight, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@struxa/ui/components/dialog";

function invalidateNests() {
  void queryClient.invalidateQueries(orpc.nests.list.queryOptions());
}

function invalidateEggs(nestId: string) {
  void queryClient.invalidateQueries(orpc.eggs.listByNest.queryOptions({ input: { nestId } }));
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

const PAGE_SIZE = 15;

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export default function NestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("admin.nests");
  const tc = useTranslations("common");

  const { id: nestId } = use(params);
  const { data: nests } = useQuery(orpc.nests.list.queryOptions());
  const { data: eggs, isLoading } = useQuery(
    orpc.eggs.listByNest.queryOptions({ input: { nestId } }),
  );

  const nest = nests?.find((n) => n.id === nestId);

  const updateNestMutation = useMutation(
    orpc.nests.update.mutationOptions({
      onSuccess: () => { invalidateNests(); toast.success(tc("saved")); },
    }),
  );
  const importMutation = useMutation(
    orpc.eggs.importJson.mutationOptions({
      onSuccess: () => { invalidateEggs(nestId); toast.success(tc("created")); },
    }),
  );
  const deleteMutation = useMutation(
    orpc.eggs.delete.mutationOptions({
      onSuccess: () => { invalidateEggs(nestId); toast.success(tc("deleted")); },
    }),
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  const [nestName, setNestName] = useState("");
  const [nestAuthor, setNestAuthor] = useState("");
  const [nestDescription, setNestDescription] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importMode, setImportMode] = useState<"paste" | "url">("paste");
  const [isDragging, setIsDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const filtered = (eggs ?? []).filter((e) => {
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    if (nest) {
      setNestName(nest.name);
      setNestAuthor(nest.author ?? "");
      setNestDescription(nest.description ?? "");
    }
  }, [nest]);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setImportJson(text);
        setImportMode("paste");
      }
    };
    reader.readAsText(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
    if (importFileRef.current) importFileRef.current.value = "";
  }

  const isImporting = importMutation.isPending || isFetchingUrl;

  async function handleImport() {
    let json = importJson.trim();
    setUrlFetchError(null);
    if (importMode === "url") {
      if (!importUrl.trim()) return;
      setIsFetchingUrl(true);
      try {
        const res = await fetch(importUrl.trim());
        if (!res.ok) {
          setUrlFetchError(t("urlFetchFailed", { status: res.status }));
          return;
        }
        json = await res.text();
      } catch (e) {
        setUrlFetchError(e instanceof Error ? e.message : t("urlFetchFailed", { status: "?" }));
        return;
      } finally {
        setIsFetchingUrl(false);
      }
    }
    if (!json) return;
    try {
      await importMutation.mutateAsync({ nestId, json });
      setImportJson("");
      setImportUrl("");
      setShowImport(false);
    } catch {
      // error toasted globally via MutationCache.onError
    }
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
        label: tc("delete"),
        icon: Trash2,
        onClick: () => setConfirmDelete(egg.id),
        destructive: true,
      },
    ];
  }

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <>
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t("deleteEggTitle")}
        description={t("deleteEggDesc")}
        confirmLabel={tc("delete")}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteMutation.mutateAsync({ id: confirmDelete });
          setConfirmDelete(null);
        }}
      />

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogPopup showCloseButton={false} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("importDialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 py-4">
            <input
              ref={importFileRef}
              id="egg-import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => importFileRef.current?.click()}
              className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isDragging
                  ? "border-ring bg-muted/60"
                  : "border-border bg-muted/20 hover:border-ring/50 hover:bg-muted/40"
              }`}
            >
              <FileJson className="h-8 w-8 text-muted-foreground/60" />
              <span className="text-sm text-muted-foreground">{t("dropzoneLabel")}</span>
            </button>

            <div className="flex gap-0 border-b border-border">
              <button
                type="button"
                onClick={() => setImportMode("paste")}
                className={`px-3 pb-2 text-xs font-medium transition-colors ${
                  importMode === "paste"
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("pasteJsonTab")}
              </button>
              <button
                type="button"
                onClick={() => setImportMode("url")}
                className={`px-3 pb-2 text-xs font-medium transition-colors ${
                  importMode === "url"
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("fromUrlTab")}
              </button>
            </div>

            {importMode === "paste" && (
              <textarea
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                rows={8}
                placeholder={t("jsonPlaceholder")}
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
              />
            )}

            {importMode === "url" && (
              <input
                autoFocus
                type="url"
                className={inputClass()}
                placeholder={t("urlPlaceholder")}
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
            )}

            {importMode === "url" && urlFetchError && (
              <span className="text-xs text-destructive">{urlFetchError}</span>
            )}
          </div>

          <DialogFooter>
            <DialogClose className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {isImporting ? tc("importing") : tc("import")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-3xl flex flex-col gap-4">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Link href={"/admin/nests" as never} className="text-muted-foreground transition-colors hover:text-foreground">
                {t("nestsLink")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="font-medium text-foreground">{nest?.name ?? nestId}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <FileJson className="h-3.5 w-3.5" />
              {tc("import")}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("nestSettingsTitle")}</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("nameLabel")}</label>
                  <input className={inputClass()} value={nestName} onChange={(e) => setNestName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("authorLabel")}</label>
                  <input className={inputClass()} value={nestAuthor} onChange={(e) => setNestAuthor(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("descriptionLabel")}</label>
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
                  {updateNestMutation.isPending ? tc("saving") : tc("save")}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t("eggsTitle")}</h2>
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("searchEggs")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px] overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[1fr_220px_36px] border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
                <span className="text-xs font-medium text-muted-foreground">{t("startupColumn")}</span>
                <span />
              </div>

              {isLoading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">{tc("loading")}</div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? t("noEggsSearch") : t("noEggs")}
                </div>
              )}
              {paginated.map((egg, i) => {
                const actions = eggActions(egg);
                const isLast = i === paginated.length - 1;
                return (
                  <ContextMenu key={egg.id} items={actions}>
                    {({ onContextMenu }) => (
                      <div
                        onContextMenu={onContextMenu}
                        className={`grid grid-cols-[1fr_220px_36px] cursor-pointer items-center px-4 py-3 transition-colors hover:bg-muted/40 ${!isLast ? "border-b border-border" : ""}`}
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <Link
                            href={`/admin/nests/${nestId}/eggs/${egg.id}` as never}
                            className="w-fit text-sm font-medium text-foreground transition-colors hover:text-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {egg.name}
                          </Link>
                          {egg.description && (
                            <span className="truncate text-xs text-muted-foreground">{egg.description}</span>
                          )}
                        </div>
                        <span className="truncate font-mono text-xs text-muted-foreground">{egg.startup}</span>
                        <RowMenu items={actions} />
                      </div>
                    )}
                  </ContextMenu>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                aria-label={t("prevPage")}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span key={`ellipsis-${i}`} className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      n === page
                        ? "bg-foreground text-background"
                        : "border border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                type="button"
                aria-label={t("nextPage")}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
