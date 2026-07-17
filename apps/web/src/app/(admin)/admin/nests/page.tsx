"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Search, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.nests.key() });
}

export default function NestsPage() {
  const t = useTranslations("admin.nests");
  const tc = useTranslations("common");

  const { data: nests, isLoading } = useQuery(orpc.nests.list.queryOptions());
  const createMutation = useMutation(orpc.nests.create.mutationOptions({
    onSuccess: () => { invalidate(); toast.success(tc("created")); },
  }));
  const deleteMutation = useMutation(orpc.nests.delete.mutationOptions({
    onSuccess: () => { invalidate(); toast.success(tc("deleted")); },
  }));

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", author: "admin" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = (nests ?? []).filter((n) => {
    const q = search.toLowerCase();
    return n.name.toLowerCase().includes(q) || (n.author ?? "").toLowerCase().includes(q);
  });

  function closeCreate() {
    setShowCreate(false);
    setForm({ name: "", description: "", author: "admin" });
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    await createMutation.mutateAsync(form);
    closeCreate();
  }

  function nestActions(nest: { id: string; name: string }): ActionItem[] {
    return [
      {
        label: tc("delete"),
        icon: Trash2,
        onClick: () => setConfirmDelete(nest.id),
        destructive: true,
      },
    ];
  }

  return (
    <>
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("nameLabel")} <span className="text-destructive">*</span></label>
              <input
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") closeCreate(); }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("authorLabel")}</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("authorPlaceholder")}
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") closeCreate(); }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">{t("descriptionLabel")}</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") closeCreate(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!form.name.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? tc("creating") : t("newNest")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                className="rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newNest")}
            </button>
          </div>
        </div>

        <ConfirmDialog
          open={confirmDelete !== null}
          onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
          title={t("deleteTitle")}
          description={t("deleteDesc")}
          confirmLabel={tc("delete")}
          destructive
          loading={deleteMutation.isPending}
          onConfirm={async () => {
            if (!confirmDelete) return;
            await deleteMutation.mutateAsync({ id: confirmDelete });
            setConfirmDelete(null);
          }}
        />

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_160px_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("authorColumn")}</span>
            <span />
          </div>

          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{tc("loading")}</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search ? t("emptySearch") : t("empty")}
            </div>
          )}
          {filtered.map((nest, i) => {
            const actions = nestActions(nest);
            const isLast = i === filtered.length - 1;
            return (
              <ContextMenu key={nest.id} items={actions}>
                {({ onContextMenu }) => (
                  <div
                    onContextMenu={onContextMenu}
                    className={`grid grid-cols-[1fr_160px_48px] items-center px-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/nests/${nest.id}` as never}
                        className="flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {nest.name}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </Link>
                      {nest.description && <span className="text-xs text-muted-foreground">{nest.description}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{nest.author ?? "—"}</span>
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
      </div>
    </>
  );
}
