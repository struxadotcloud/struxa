"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ChevronDown, Trash2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@struxa/ui/components/dialog";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipPopup,
  TooltipProvider,
} from "@struxa/ui/components/tooltip";

function NodeStatusDot({
  fqdn,
  daemonListen,
  scheme,
  maintenanceMode,
}: {
  fqdn: string;
  daemonListen: number;
  scheme: string;
  maintenanceMode: boolean;
}) {
  const t = useTranslations("admin.nodes");

  const { data, isPending } = useQuery({
    queryKey: ["node-status", scheme, fqdn, daemonListen],
    queryFn: async () => {
      try {
        await fetch(`${scheme}://${fqdn}:${daemonListen}/`, {
          mode: "no-cors",
          signal: AbortSignal.timeout(5000),
        });
        return { online: true };
      } catch {
        return { online: false };
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  const label = maintenanceMode
    ? t("maintenance")
    : isPending
      ? t("checking")
      : data?.online
        ? t("online")
        : t("offline");

  const dotColor = maintenanceMode
    ? "bg-amber-500/60"
    : isPending
      ? "bg-muted-foreground/30 animate-pulse"
      : data?.online
        ? "bg-green-500"
        : "bg-red-500";

  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </TooltipTrigger>
      <TooltipPopup side="right" sideOffset={6}>
        {label}
      </TooltipPopup>
    </Tooltip>
  );
}

function invalidate() {
  void queryClient.invalidateQueries({ queryKey: orpc.nodes.key() });
}

export default function NodesPage() {
  const t = useTranslations("admin.nodes");
  const tc = useTranslations("common");

  const { data: nodes, isLoading } = useQuery(orpc.nodes.list.queryOptions());
  const { data: locations } = useQuery(orpc.locations.list.queryOptions());
  const createMutation = useMutation(orpc.nodes.create.mutationOptions({ onSuccess: invalidate }));
  const deleteMutation = useMutation(orpc.nodes.delete.mutationOptions({ onSuccess: invalidate }));

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
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

  function closeCreate() {
    setShowCreate(false);
    setForm({ name: "", locationId: "", fqdn: "", scheme: "https", memory: 4096, memoryOverallocate: 0, disk: 51200, diskOverallocate: 0, daemonListen: 8080, daemonSFTP: 2022, uploadSize: 100 });
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.locationId || !form.fqdn.trim()) return;
    await createMutation.mutateAsync(form);
    closeCreate();
  }

  function nodeActions(node: { id: string; name: string }): ActionItem[] {
    return [
      {
        label: tc("delete"),
        icon: Trash2,
        onClick: () => setConfirmDelete(node.id),
        destructive: true,
      },
    ];
  }

  return (
    <>
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogPopup showCloseButton={false} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("nameLabel")} <span className="text-destructive">*</span></label>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={t("namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("locationLabel")} <span className="text-destructive">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span className={form.locationId ? "text-foreground" : "text-muted-foreground/50"}>
                      {form.locationId ? (locations?.find((l) => l.id === form.locationId)?.name ?? "Select…") : t("locationPlaceholder")}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg">
                    {locations?.map((l) => (
                      <DropdownMenuItem key={l.id} onClick={() => setForm((f) => ({ ...f, locationId: l.id }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.locationId === l.id ? "bg-green-500" : "bg-transparent"}`} />
                        {l.name} <span className="text-muted-foreground/50">({l.short})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("fqdnLabel")} <span className="text-destructive">*</span></label>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                  placeholder={t("fqdnPlaceholder")}
                  value={form.fqdn}
                  onChange={(e) => setForm((f) => ({ ...f, fqdn: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("schemeLabel")}</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span>{form.scheme.toUpperCase()}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className="rounded-xl border border-border bg-card p-1 shadow-lg">
                    {(["https", "http"] as const).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => setForm((f) => ({ ...f, scheme: s }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.scheme === s ? "bg-green-500" : "bg-transparent"}`} />
                        {s.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("memoryLabel")}</label>
                <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  value={form.memory} onChange={(e) => setForm((f) => ({ ...f, memory: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("diskLabel")}</label>
                <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  value={form.disk} onChange={(e) => setForm((f) => ({ ...f, disk: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("daemonPortLabel")}</label>
                <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  value={form.daemonListen} onChange={(e) => setForm((f) => ({ ...f, daemonListen: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("sftpPortLabel")}</label>
                <input type="number" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  value={form.daemonSFTP} onChange={(e) => setForm((f) => ({ ...f, daemonSFTP: Number(e.target.value) }))} />
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive">{createMutation.error.message}</p>
            )}
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
              disabled={!form.name.trim() || !form.locationId || !form.fqdn.trim() || createMutation.isPending}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? tc("creating") : t("newNode")}
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
              {t("newNode")}
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

        <TooltipProvider>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_200px_160px_48px] border-b border-border bg-muted/40 px-4 py-2.5">
            <span />
            <span className="text-xs font-medium text-muted-foreground">{t("nameColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("addressColumn")}</span>
            <span className="text-xs font-medium text-muted-foreground">{t("resourcesColumn")}</span>
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
                    <NodeStatusDot fqdn={node.fqdn} daemonListen={node.daemonListen} scheme={node.scheme} maintenanceMode={node.maintenanceMode} />
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
                          {t("maintenance")}
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
        </TooltipProvider>
        </div>
      </div>
    </>
  );
}
