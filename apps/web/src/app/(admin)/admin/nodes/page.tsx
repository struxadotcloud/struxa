"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Search,
  Pencil,
  MapPin,
  Server,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
  SheetPanel,
} from "@struxa/ui/components/sheet";
import { useIsMobile } from "@struxa/ui/hooks/use-media-query";
import { Switch } from "@struxa/ui/components/switch";
import { BackupDestinationForm, defaultBackupDestination } from "@/components/backup-destination-form";
import type { BackupDestinationInput } from "@struxa/api/lib/backup-destinations";
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

type LocationData = { id: string; name: string; short: string; long: string | null };

type NodeItem = {
  id: string;
  name: string;
  fqdn: string;
  daemonListen: number;
  scheme: string;
  maintenanceMode: boolean;
  memory: number;
  disk: number;
  locationId: string;
};

function NodeRow({
  node,
  isLast,
  onDelete,
}: {
  node: NodeItem;
  isLast: boolean;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("admin.nodes");
  const tc = useTranslations("common");
  const actions: ActionItem[] = [
    { label: tc("delete"), icon: Trash2, onClick: () => onDelete(node.id), destructive: true },
  ];
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
              className="text-sm font-medium text-foreground transition-colors hover:text-blue-500"
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
            {t("resources", {
              memory: (node.memory / 1024).toFixed(1),
              disk: (node.disk / 1024).toFixed(1),
            })}
          </span>
          <div className="flex items-center justify-end">
            <RowMenu items={actions} />
          </div>
        </div>
      )}
    </ContextMenu>
  );
}

function LocationEditModal({
  location,
  onClose,
  onSave,
  isPending,
}: {
  location: LocationData | null;
  onClose: () => void;
  onSave: (form: { name: string; short: string; long: string }) => void;
  isPending: boolean;
}) {
  const tl = useTranslations("admin.locations");
  const tc = useTranslations("common");
  const isMobile = useIsMobile();
  const [form, setForm] = useState({ name: "", short: "", long: "" });

  useEffect(() => {
    if (location) setForm({ name: location.name, short: location.short, long: location.long ?? "" });
  }, [location]);

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  const inputBase =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";

  const fields = (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          {tl("shortCodeLabel")} <span className="text-destructive">*</span>
        </label>
        <input
          className={inputBase}
          placeholder={tl("shortCodePlaceholder")}
          value={form.short}
          onChange={(e) => setForm((f) => ({ ...f, short: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(form);
            if (e.key === "Escape") onClose();
          }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          {tl("nameLabel")} <span className="text-destructive">*</span>
        </label>
        <input
          autoFocus
          className={inputBase}
          placeholder={tl("namePlaceholder")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(form);
            if (e.key === "Escape") onClose();
          }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">
          {tl("descriptionLabel")}
        </label>
        <input
          className={inputBase}
          placeholder={tl("descriptionPlaceholder")}
          value={form.long}
          onChange={(e) => setForm((f) => ({ ...f, long: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(form);
            if (e.key === "Escape") onClose();
          }}
        />
      </div>
    </div>
  );

  const saveDisabled = !form.name.trim() || !form.short.trim() || isPending;

  if (isMobile) {
    return (
      <Sheet open={!!location} onOpenChange={handleOpenChange}>
        <SheetPopup side="bottom" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle>{tl("editTitle")}</SheetTitle>
          </SheetHeader>
          <SheetPanel>{fields}</SheetPanel>
          <SheetFooter>
            <SheetClose
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={isPending}
            >
              {tc("cancel")}
            </SheetClose>
            <button
              type="button"
              onClick={() => onSave(form)}
              disabled={saveDisabled}
              className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {isPending ? tc("saving") : tc("save")}
            </button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>
    );
  }

  return (
    <Dialog open={!!location} onOpenChange={handleOpenChange}>
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{tl("editTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-5 py-4">{fields}</div>
        <DialogFooter>
          <DialogClose
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            disabled={isPending}
          >
            {tc("cancel")}
          </DialogClose>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={saveDisabled}
            className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {isPending ? tc("saving") : tc("save")}
          </button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
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
  backupUseGlobal: true,
  backupDestination: defaultBackupDestination("s3") as BackupDestinationInput,
};

export default function NodesPage() {
  const t = useTranslations("admin.nodes");
  const tl = useTranslations("admin.locations");
  const tc = useTranslations("common");

  const { data: nodes, isLoading: nodesLoading } = useQuery(orpc.nodes.list.queryOptions());
  const { data: locations, isLoading: locationsLoading } = useQuery(orpc.locations.list.queryOptions());
  const isLoading = nodesLoading || locationsLoading;

  const createNodeMutation = useMutation(orpc.nodes.create.mutationOptions({
    onSuccess: () => { invalidateNodes(); toast.success(tc("created")); },
  }));
  const upsertNodeDestinationMutation = useMutation(orpc.backupDestinations.upsertForNode.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.backupDestinations.key() });
    },
  }));
  const deleteNodeMutation = useMutation(orpc.nodes.delete.mutationOptions({
    onSuccess: () => { invalidateNodes(); toast.success(tc("deleted")); },
  }));

  const createLocationMutation = useMutation(
    orpc.locations.create.mutationOptions({
      onSuccess: () => { invalidateLocations(); toast.success(tc("created")); },
    }),
  );
  const updateLocationMutation = useMutation(
    orpc.locations.update.mutationOptions({
      onSuccess: () => { invalidateLocations(); toast.success(tc("saved")); },
    }),
  );
  const deleteLocationMutation = useMutation(
    orpc.locations.delete.mutationOptions({
      onSuccess: () => { invalidateLocations(); toast.success(tc("deleted")); },
    }),
  );

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showCreateNode, setShowCreateNode] = useState(false);
  const [nodeForm, setNodeForm] = useState(defaultNodeForm);

  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: "", short: "", long: "" });

  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);

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
  const unassignedNodes = allNodes.filter((n) => !assignedIds.has(n.locationId));
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
    try {
      const node = await createNodeMutation.mutateAsync({
        name: nodeForm.name,
        locationId: nodeForm.locationId,
        fqdn: nodeForm.fqdn,
        scheme: nodeForm.scheme,
        memory: nodeForm.memory,
        memoryOverallocate: nodeForm.memoryOverallocate,
        disk: nodeForm.disk,
        diskOverallocate: nodeForm.diskOverallocate,
        daemonListen: nodeForm.daemonListen,
        daemonSFTP: nodeForm.daemonSFTP,
        uploadSize: nodeForm.uploadSize,
      });
      if (!nodeForm.backupUseGlobal && node) {
        await upsertNodeDestinationMutation.mutateAsync({
          nodeId: node.id,
          ...nodeForm.backupDestination,
        });
      }
      closeCreateNode();
    } catch {
      // error toasted globally via MutationCache.onError
    }
  }

  function closeCreateLocation() {
    setShowCreateLocation(false);
    setLocationForm({ name: "", short: "", long: "" });
  }

  async function handleCreateLocation() {
    if (!locationForm.name.trim() || !locationForm.short.trim() || createLocationMutation.isPending) return;
    try {
      await createLocationMutation.mutateAsync(locationForm);
      closeCreateLocation();
    } catch {
      // error toasted globally via MutationCache.onError
    }
  }

  async function handleUpdateLocation(form: { name: string; short: string; long: string }) {
    if (!editingLocation || !form.name.trim() || !form.short.trim() || updateLocationMutation.isPending) return;
    try {
      await updateLocationMutation.mutateAsync({ id: editingLocation.id, ...form });
      setEditingLocation(null);
    } catch {
      // error toasted globally via MutationCache.onError
    }
  }

  function locationActions(loc: LocationData): ActionItem[] {
    return [
      {
        label: tc("edit"),
        icon: Pencil,
        onClick: () => setEditingLocation(loc),
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

  const hasAny = allLocations.length > 0 || allNodes.length > 0;
  const noResults =
    !isLoading && hasAny && visibleLocations.length === 0 && visibleUnassigned.length === 0;

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
                        ? (allLocations.find((l) => l.id === nodeForm.locationId)?.name ?? t("locationPlaceholder"))
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
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeForm.locationId === l.id ? "bg-blue-500" : "bg-transparent"}`}
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
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeForm.scheme === s ? "bg-blue-500" : "bg-transparent"}`}
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

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("backupDestinationSection")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("backupUseGlobalDesc")}</p>
                </div>
                <Switch
                  checked={nodeForm.backupUseGlobal}
                  onCheckedChange={(checked) =>
                    setNodeForm((f) => ({ ...f, backupUseGlobal: checked }))
                  }
                />
              </div>
              {!nodeForm.backupUseGlobal && (
                <div className="mt-3">
                  <BackupDestinationForm
                    value={nodeForm.backupDestination}
                    onChange={(destination) =>
                      setNodeForm((f) => ({ ...f, backupDestination: destination }))
                    }
                  />
                </div>
              )}
            </div>
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

      <LocationEditModal
        location={editingLocation}
        onClose={() => setEditingLocation(null)}
        onSave={(form) => void handleUpdateLocation(form)}
        isPending={updateLocationMutation.isPending}
      />

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
                  className="min-w-56 rounded-xl border border-border bg-card p-1 shadow-lg"
                >
                  <DropdownMenuItem
                    onClick={() => setShowCreateLocation(true)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {t("createLocation")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 border-border" />
                  <DropdownMenuItem
                    onClick={() => setShowCreateNode(true)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <Server className="h-3.5 w-3.5 shrink-0" />
                    {t("createNode")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TooltipProvider>
            <div className="overflow-x-auto">
              <div className="min-w-[520px] overflow-hidden rounded-xl border border-border bg-card">
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

                      {!isCollapsed &&
                        locNodes.map((node, ni) => {
                          const isAbsoluteLast =
                            isLastSection &&
                            ni === locNodes.length - 1 &&
                            visibleUnassigned.length === 0;
                          return (
                            <NodeRow key={node.id} node={node} isLast={isAbsoluteLast} onDelete={setConfirmDeleteNode} />
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
                          onDelete={setConfirmDeleteNode}
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
