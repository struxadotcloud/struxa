"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Search,
  Pencil,
  Check,
  X,
  MapPin,
  Server,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

function invalidateNodes() {
  void queryClient.invalidateQueries({ queryKey: orpc.nodes.key() });
}
function invalidateLocations() {
  void queryClient.invalidateQueries({ queryKey: orpc.locations.key() });
}

function inputCls(small?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 ${small ? "py-1" : "py-2"} text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors`;
}

const defaultNodeForm = {
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
};

export default function NodesPage() {
  const t = useTranslations("admin.nodes");
  const tl = useTranslations("admin.locations");
  const tc = useTranslations("common");

  const { data: nodes, isLoading: nodesLoading } = useQuery(orpc.nodes.list.queryOptions());
  const { data: locations, isLoading: locationsLoading } = useQuery(orpc.locations.list.queryOptions());
  const isLoading = nodesLoading || locationsLoading;

  const createNodeMutation = useMutation(orpc.nodes.create.mutationOptions({ onSuccess: invalidateNodes }));
  const deleteNodeMutation = useMutation(orpc.nodes.delete.mutationOptions({ onSuccess: invalidateNodes }));

  const createLocationMutation = useMutation(
    orpc.locations.create.mutationOptions({ onSuccess: invalidateLocations }),
  );
  const updateLocationMutation = useMutation(
    orpc.locations.update.mutationOptions({ onSuccess: invalidateLocations }),
  );
  const deleteLocationMutation = useMutation(
    orpc.locations.delete.mutationOptions({ onSuccess: invalidateLocations }),
  );

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showCreateNode, setShowCreateNode] = useState(false);
  const [nodeForm, setNodeForm] = useState(defaultNodeForm);

  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: "", short: "", long: "" });

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationForm, setEditLocationForm] = useState({ name: "", short: "", long: "" });

  const [confirmDeleteNode, setConfirmDeleteNode] = useState<string | null>(null);
  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<string | null>(null);

  const allLocations = locations ?? [];
  const allNodes = nodes ?? [];
  const q = search.toLowerCase();

  const visibleLocations = q
    ? allLocations.filter((loc) => {
        const locMatch =
          loc.name.toLowerCase().includes(q) || loc.short.toLowerCase().includes(q);
        const nodeMatch = allNodes.some(
          (n) =>
            n.locationId === loc.id &&
            (n.name.toLowerCase().includes(q) || n.fqdn.toLowerCase().includes(q)),
        );
        return locMatch || nodeMatch;
      })
    : allLocations;

  const assignedIds = new Set(allLocations.map((l) => l.id));
  const unassignedNodes = allNodes.filter((n) => !assignedIds.has(n.locationId ?? ""));
  const visibleUnassigned = q
    ? unassignedNodes.filter(
        (n) => n.name.toLowerCase().includes(q) || n.fqdn.toLowerCase().includes(q),
      )
    : unassignedNodes;

  function getVisibleNodes(locationId: string) {
    const all = allNodes.filter((n) => n.locationId === locationId);
    if (!q) return all;
    const locMatch = allLocations.some(
      (l) =>
        l.id === locationId &&
        (l.name.toLowerCase().includes(q) || l.short.toLowerCase().includes(q)),
    );
    if (locMatch) return all;
    return all.filter((n) => n.name.toLowerCase().includes(q) || n.fqdn.toLowerCase().includes(q));
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeCreateNode() {
    setShowCreateNode(false);
    setNodeForm(defaultNodeForm);
  }

  async function handleCreateNode() {
    if (!nodeForm.name.trim() || !nodeForm.locationId || !nodeForm.fqdn.trim()) return;
    await createNodeMutation.mutateAsync(nodeForm);
    closeCreateNode();
  }

  function closeCreateLocation() {
    setShowCreateLocation(false);
    setLocationForm({ name: "", short: "", long: "" });
  }

  async function handleCreateLocation() {
    if (!locationForm.name.trim() || !locationForm.short.trim()) return;
    await createLocationMutation.mutateAsync(locationForm);
    closeCreateLocation();
  }

  async function handleUpdateLocation() {
    if (!editingLocationId || !editLocationForm.name.trim() || !editLocationForm.short.trim())
      return;
    await updateLocationMutation.mutateAsync({ id: editingLocationId, ...editLocationForm });
    setEditingLocationId(null);
  }

  function locationActions(loc: {
    id: string;
    name: string;
    short: string;
    long: string | null;
  }): ActionItem[] {
    return [
      {
        label: tc("edit"),
        icon: Pencil,
        onClick: () => {
          setEditingLocationId(loc.id);
          setEditLocationForm({ name: loc.name, short: loc.short, long: loc.long ?? "" });
        },
      },
      "separator",
      {
        label: tc("delete"),
        icon: Trash2,
        onClick: () => setConfirmDeleteLocation(loc.id),
        destructive: true,
      },
    ];
  }

  function nodeActions(node: { id: string }): ActionItem[] {
    return [
      {
        label: tc("delete"),
        icon: Trash2,
        onClick: () => setConfirmDeleteNode(node.id),
        destructive: true,
      },
    ];
  }

  const hasAny = allLocations.length > 0 || allNodes.length > 0;
  const noResults =
    !isLoading && hasAny && visibleLocations.length === 0 && visibleUnassigned.length === 0;

  function NodeRow({
    node,
    isLast,
  }: {
    node: (typeof allNodes)[number];
    isLast: boolean;
  }) {
    const actions = nodeActions(node);
    return (
      <ContextMenu items={actions}>
        {({ onContextMenu }) => (
          <div
            onContextMenu={onContextMenu}
            className={`grid grid-cols-[24px_1fr_200px_160px_48px] items-center pl-10 pr-4 py-3 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}
          >
            <NodeStatusDot
              fqdn={node.fqdn}
              daemonListen={node.daemonListen}
              scheme={node.scheme}
              maintenanceMode={node.maintenanceMode}
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
  }

  return (
    <>
      {/* Create Location Dialog */}
      <Dialog
        open={showCreateLocation}
        onOpenChange={(open) => {
          if (!open) closeCreateLocation();
        }}
      >
        <DialogPopup showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{tl("dialogTitle")}</DialogTitle>
            <DialogDescription>{tl("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                {tl("nameLabel")} <span className="text-destructive">*</span>
              </label>
              <input
                autoFocus
                className={inputCls()}
                placeholder={tl("namePlaceholder")}
                value={locationForm.name}
                onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateLocation();
                  if (e.key === "Escape") closeCreateLocation();
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                {tl("shortCodeLabel")} <span className="text-destructive">*</span>
              </label>
              <input
                className={inputCls()}
                placeholder={tl("shortCodePlaceholder")}
                value={locationForm.short}
                onChange={(e) => setLocationForm((f) => ({ ...f, short: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateLocation();
                  if (e.key === "Escape") closeCreateLocation();
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                {tl("descriptionLabel")}
              </label>
              <input
                className={inputCls()}
                placeholder={tl("descriptionPlaceholder")}
                value={locationForm.long}
                onChange={(e) => setLocationForm((f) => ({ ...f, long: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateLocation();
                  if (e.key === "Escape") closeCreateLocation();
                }}
              />
            </div>
            {createLocationMutation.isError && (
              <p className="text-xs text-destructive">{createLocationMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createLocationMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreateLocation()}
              disabled={
                !locationForm.name.trim() ||
                !locationForm.short.trim() ||
                createLocationMutation.isPending
              }
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createLocationMutation.isPending ? tc("creating") : tl("newLocation")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Create Node Dialog */}
      <Dialog
        open={showCreateNode}
        onOpenChange={(open) => {
          if (!open) closeCreateNode();
        }}
      >
        <DialogPopup showCloseButton={false} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("nameLabel")} <span className="text-destructive">*</span>
                </label>
                <input
                  autoFocus
                  className={inputCls()}
                  placeholder={t("namePlaceholder")}
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("locationLabel")} <span className="text-destructive">*</span>
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span className={nodeForm.locationId ? "text-foreground" : "text-muted-foreground/50"}>
                      {nodeForm.locationId
                        ? (allLocations.find((l) => l.id === nodeForm.locationId)?.name ?? "Select…")
                        : t("locationPlaceholder")}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={4}
                    className="rounded-xl border border-border bg-card p-1 shadow-lg"
                  >
                    {allLocations.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        onClick={() => setNodeForm((f) => ({ ...f, locationId: l.id }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeForm.locationId === l.id ? "bg-green-500" : "bg-transparent"}`}
                        />
                        {l.name}{" "}
                        <span className="text-muted-foreground/50">({l.short})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("fqdnLabel")} <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputCls()}
                  placeholder={t("fqdnPlaceholder")}
                  value={nodeForm.fqdn}
                  onChange={(e) => setNodeForm((f) => ({ ...f, fqdn: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("schemeLabel")}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                    <span>{nodeForm.scheme.toUpperCase()}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={4}
                    className="rounded-xl border border-border bg-card p-1 shadow-lg"
                  >
                    {(["https", "http"] as const).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setNodeForm((f) => ({ ...f, scheme: s }))}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeForm.scheme === s ? "bg-green-500" : "bg-transparent"}`}
                        />
                        {s.toUpperCase()}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("memoryLabel")}
                </label>
                <input
                  type="number"
                  className={inputCls()}
                  value={nodeForm.memory}
                  onChange={(e) => setNodeForm((f) => ({ ...f, memory: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("diskLabel")}
                </label>
                <input
                  type="number"
                  className={inputCls()}
                  value={nodeForm.disk}
                  onChange={(e) => setNodeForm((f) => ({ ...f, disk: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("daemonPortLabel")}
                </label>
                <input
                  type="number"
                  className={inputCls()}
                  value={nodeForm.daemonListen}
                  onChange={(e) =>
                    setNodeForm((f) => ({ ...f, daemonListen: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {t("sftpPortLabel")}
                </label>
                <input
                  type="number"
                  className={inputCls()}
                  value={nodeForm.daemonSFTP}
                  onChange={(e) =>
                    setNodeForm((f) => ({ ...f, daemonSFTP: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            {createNodeMutation.isError && (
              <p className="text-xs text-destructive">{createNodeMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={createNodeMutation.isPending}
            >
              {tc("cancel")}
            </DialogClose>
            <button
              type="button"
              onClick={() => void handleCreateNode()}
              disabled={
                !nodeForm.name.trim() ||
                !nodeForm.locationId ||
                !nodeForm.fqdn.trim() ||
                createNodeMutation.isPending
              }
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createNodeMutation.isPending ? tc("creating") : t("newNode")}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteNode !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteNode(null);
        }}
        title={t("deleteTitle")}
        description={t("deleteDesc")}
        confirmLabel={tc("delete")}
        destructive
        loading={deleteNodeMutation.isPending}
        onConfirm={async () => {
          if (!confirmDeleteNode) return;
          await deleteNodeMutation.mutateAsync({ id: confirmDeleteNode });
          setConfirmDeleteNode(null);
        }}
      />

      <ConfirmDialog
        open={confirmDeleteLocation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteLocation(null);
        }}
        title={tl("deleteTitle")}
        description={tl("deleteDesc")}
        confirmLabel={tc("delete")}
        destructive
        loading={deleteLocationMutation.isPending}
        onConfirm={async () => {
          if (!confirmDeleteLocation) return;
          await deleteLocationMutation.mutateAsync({ id: confirmDeleteLocation });
          setConfirmDeleteLocation(null);
        }}
      />

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
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
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80">
                  <Plus className="h-3.5 w-3.5" />
                  {t("create")}
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={4}
                  className="rounded-xl border border-border bg-card p-1 shadow-lg"
                >
                  <DropdownMenuItem
                    onClick={() => setShowCreateLocation(true)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {t("createLocation")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 border-border" />
                  <DropdownMenuItem
                    onClick={() => setShowCreateNode(true)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <Server className="h-3.5 w-3.5" />
                    {t("createNode")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TooltipProvider>
            <div className="overflow-x-auto">
              <div className="min-w-[520px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {/* Column header — aligns with node rows (pl-10) */}
                <div className="grid grid-cols-[24px_1fr_200px_160px_48px] border-b border-border bg-muted/40 pl-10 pr-4 py-2.5">
                  <span />
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("nameColumn")}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("addressColumn")}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("resourcesColumn")}
                  </span>
                  <span />
                </div>

                {isLoading && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {tc("loading")}
                  </div>
                )}
                {!isLoading && !hasAny && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </div>
                )}
                {noResults && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t("emptySearch")}
                  </div>
                )}

                {visibleLocations.map((loc, li) => {
                  const isCollapsed = collapsed.has(loc.id);
                  const locNodes = getVisibleNodes(loc.id);
                  const isLastSection =
                    li === visibleLocations.length - 1 && visibleUnassigned.length === 0;
                  const showBottomBorder = !isLastSection || (!isCollapsed && locNodes.length > 0);

                  return (
                    <div key={loc.id}>
                      {editingLocationId === loc.id ? (
                        <div
                          className={`flex items-center gap-2 bg-muted/30 px-4 py-2 ${showBottomBorder ? "border-b border-border" : ""}`}
                        >
                          <input
                            autoFocus
                            className="w-24 shrink-0 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring transition-colors"
                            value={editLocationForm.short}
                            onChange={(e) =>
                              setEditLocationForm((f) => ({ ...f, short: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUpdateLocation();
                              if (e.key === "Escape") setEditingLocationId(null);
                            }}
                          />
                          <input
                            className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring transition-colors"
                            value={editLocationForm.name}
                            onChange={(e) =>
                              setEditLocationForm((f) => ({ ...f, name: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUpdateLocation();
                              if (e.key === "Escape") setEditingLocationId(null);
                            }}
                          />
                          <input
                            className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-ring transition-colors placeholder:text-muted-foreground/50"
                            placeholder={tl("descriptionPlaceholder")}
                            value={editLocationForm.long}
                            onChange={(e) =>
                              setEditLocationForm((f) => ({ ...f, long: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleUpdateLocation();
                              if (e.key === "Escape") setEditingLocationId(null);
                            }}
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleUpdateLocation()}
                              disabled={updateLocationMutation.isPending}
                              className="flex h-6 w-6 items-center justify-center rounded text-green-500 hover:bg-muted transition-colors disabled:opacity-40"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLocationId(null)}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <ContextMenu items={locationActions(loc)}>
                          {({ onContextMenu }) => (
                            <div
                              onContextMenu={onContextMenu}
                              className={`flex items-center justify-between bg-muted/30 px-4 py-2.5 ${showBottomBorder ? "border-b border-border" : ""}`}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleCollapse(loc.id)}
                                  className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <span className="font-mono rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                  {loc.short}
                                </span>
                                <span className="text-sm font-medium text-foreground">
                                  {loc.name}
                                </span>
                                {loc.long && (
                                  <span className="text-xs text-muted-foreground">{loc.long}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  <Server className="h-3 w-3" />
                                  {allNodes.filter((n) => n.locationId === loc.id).length}
                                </span>
                                <RowMenu items={locationActions(loc)} />
                              </div>
                            </div>
                          )}
                        </ContextMenu>
                      )}

                      {!isCollapsed &&
                        locNodes.map((node, ni) => {
                          const isAbsoluteLast =
                            isLastSection &&
                            ni === locNodes.length - 1 &&
                            visibleUnassigned.length === 0;
                          return (
                            <NodeRow key={node.id} node={node} isLast={isAbsoluteLast} />
                          );
                        })}
                    </div>
                  );
                })}

                {/* Unassigned nodes section */}
                {visibleUnassigned.length > 0 && (
                  <div>
                    <div
                      className={`flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b border-border`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCollapse("__unassigned__")}
                          className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {collapsed.has("__unassigned__") ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="text-sm font-medium text-muted-foreground">
                          {t("unassigned")}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Server className="h-3 w-3" />
                        {visibleUnassigned.length}
                      </span>
                    </div>
                    {!collapsed.has("__unassigned__") &&
                      visibleUnassigned.map((node, ni) => (
                        <NodeRow
                          key={node.id}
                          node={node}
                          isLast={ni === visibleUnassigned.length - 1}
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
