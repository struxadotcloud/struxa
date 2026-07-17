"use client";

import { use, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { Button } from "@struxa/ui/components/button";
import { DitherAvatar } from "@struxa/ui/components/dither-kit/avatar";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { orpc, queryClient } from "@/utils/orpc";
import { UserCombobox } from "@/components/user-combobox";
import { AllocationCombobox } from "@/components/allocation-combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DangerZone, DangerZoneRow } from "@/components/danger-zone";

type Tab = "general" | "resources" | "startup" | "danger";

function invalidateServer(id: string) {
  void queryClient.invalidateQueries(orpc.servers.adminGet.queryOptions({ input: { id } }));
  void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
}

function invalidateList() {
  void queryClient.invalidateQueries({ queryKey: orpc.servers.key() });
}

function inputClass(mono?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${mono ? " font-mono" : ""}`;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AdminServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const router = useRouter();
  const t = useTranslations("admin.servers");
  const tc = useTranslations("common");

  const TABS: { id: Tab; label: string }[] = [
    { id: "general", label: t("tabGeneral") },
    { id: "resources", label: t("tabResources") },
    { id: "startup", label: t("tabStartup") },
    { id: "danger", label: t("tabDanger") },
  ];

  const [tab, setTab] = useState<Tab>("general");

  const { data: server, isLoading } = useQuery(
    orpc.servers.adminGet.queryOptions({ input: { id: serverId } }),
  );

  const { data: nodesList } = useQuery(orpc.nodes.list.queryOptions());

  const [selectedNodeId, setSelectedNodeId] = useState("");

  const updateMutation = useMutation(
    orpc.servers.update.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        invalidateList();
        toast.success(tc("saved"));
      },
    }),
  );

  const updateVarsMutation = useMutation(
    orpc.servers.updateVariables.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        toast.success(t("savedRecomputed"));
      },
    }),
  );

  const suspendMutation = useMutation(
    orpc.servers.suspend.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        invalidateList();
        toast.success(tc("updated"));
      },
    }),
  );

  const reinstallMutation = useMutation(
    orpc.servers.reinstall.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        toast.success(t("reinstallTriggered"));
      },
    }),
  );

  const deleteMutation = useMutation(
    orpc.servers.delete.mutationOptions({
      onSuccess: () => {
        invalidateList();
        toast.success(tc("deleted"));
        router.push("/admin/servers" as never);
      },
    }),
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const [memory, setMemory] = useState(0);
  const [disk, setDisk] = useState(0);
  const [cpu, setCpu] = useState(0);
  const [swap, setSwap] = useState(0);
  const [io, setIo] = useState(500);
  const [threads, setThreads] = useState("");
  const [oomDisabled, setOomDisabled] = useState(false);
  const [image, setImage] = useState("");
  const [startup, setStartup] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [purge, setPurge] = useState(false);

  useEffect(() => {
    if (!server) return;
    setName(server.name);
    setDescription(server.description ?? "");
    setOwnerId(server.userId);
    setSelectedNodeId(server.nodeId);
    setAllocationId(server.allocationId);
    setMemory(server.memory);
    setDisk(server.disk);
    setCpu(server.cpu);
    setSwap(server.swap);
    setIo(server.io);
    setThreads(server.threads ?? "");
    setOomDisabled(server.oomDisabled);
    setImage(server.image);
    setStartup(server.startup);

    const vals: Record<string, string> = {};
    for (const sv of server.serverVariables) {
      vals[sv.variable.envVariable] = sv.variableValue ?? sv.variable.defaultValue ?? "";
    }
    setVariableValues(vals);
  }, [server]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {tc("loading")}
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("detailNotFound")}
      </div>
    );
  }

  const isSuspended = server.suspended;
  const nodeChanged = selectedNodeId !== server.nodeId;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.id === "startup" && server.serverVariables.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {server.serverVariables.length}
              </span>
            )}
            {t.id === "danger" && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">!</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }}>
        {tab === "general" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <SectionCard title={t("identityTitle")}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("nameLabel")}</label>
                  <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("descriptionDetailLabel")}</label>
                  <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-foreground">{t("ownerDetailLabel")}</label>
                {server.user && ownerId === server.userId ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                      {server.user.image ? (
                        <img src={server.user.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <DitherAvatar name={server.user.name ?? server.user.email} className="h-full w-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-foreground">{server.user.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOwnerId("")}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("changeOwner")}
                    </button>
                  </div>
                ) : (
                  <UserCombobox value={ownerId} onChange={setOwnerId} />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("uuidLabel")}</p>
                  <p className="font-mono text-xs text-muted-foreground">{server.uuid}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("eggDetailLabel")}</p>
                  <p className="text-sm text-foreground">{server.egg?.name ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({ id: serverId, name, description, userId: ownerId || undefined })}
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {updateMutation.isPending ? tc("saving") : tc("save")}
                </button>
              </div>
            </SectionCard>

            <SectionCard title={t("nodeAllocationTitle")}>
              {nodeChanged && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  {t("nodeChangedWarning")}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("nodeLabel")}</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                      <span>{nodesList?.find((n) => n.id === selectedNodeId)?.name ?? t("selectNode")}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border border-border bg-card p-1 shadow-lg">
                      {(nodesList ?? []).map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          onClick={() => { setSelectedNodeId(n.id); setAllocationId(""); }}
                          className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                        >
                          {n.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("allocationLabel")}</label>
                  <AllocationCombobox
                    nodeId={selectedNodeId}
                    value={allocationId}
                    onChange={setAllocationId}
                    initialAllocation={
                      !nodeChanged && server.allocation
                        ? { id: server.allocationId, ip: server.allocation.ip, port: server.allocation.port, ipAlias: server.allocation.ipAlias }
                        : null
                    }
                    placeholder={t("allocationPlaceholder")}
                    disabledPlaceholder={t("selectNodeFirst")}
                    emptyText={t("noFreeAllocationsShort")}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({
                    id: serverId,
                    nodeId: nodeChanged ? selectedNodeId : undefined,
                    allocationId: allocationId !== server.allocationId ? allocationId : undefined,
                  })}
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {updateMutation.isPending ? tc("saving") : tc("save")}
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "resources" && (
          <div className="mx-auto max-w-2xl">
            <SectionCard title={t("resourcesTitle")}>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: t("memoryLabel"), value: memory, set: setMemory },
                  { label: t("diskLabel"), value: disk, set: setDisk },
                  { label: t("cpuShortLabel"), value: cpu, set: setCpu },
                  { label: t("swapShortLabel"), value: swap, set: setSwap },
                  { label: t("ioShortLabel"), value: io, set: setIo },
                ].map(({ label, value, set }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{label}</label>
                    <input
                      type="number"
                      className={inputClass()}
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("cpuThreadsLabel")}</label>
                  <input
                    className={inputClass(true)}
                    placeholder={t("cpuThreadsPlaceholder")}
                    value={threads}
                    onChange={(e) => setThreads(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">{t("dockerImageLabel")}</label>
                  <input className={inputClass(true)} value={image} onChange={(e) => setImage(e.target.value)} />
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={oomDisabled}
                  onChange={(e) => setOomDisabled(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                {t("disableOomLabel")}
              </label>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({ id: serverId, memory, disk, cpu, swap, io, threads: threads || null, oomDisabled, image })}
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {updateMutation.isPending ? tc("saving") : t("saveResources")}
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "startup" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <SectionCard title={t("startupTitle")}>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">{t("commandLabel")}</label>
                <input className={inputClass(true)} value={startup} onChange={(e) => setStartup(e.target.value)} />
              </div>
            </SectionCard>

            {server.serverVariables.length > 0 && (
              <SectionCard title={t("envVarsTitle")}>
                <div className="grid grid-cols-2 gap-3">
                  {server.serverVariables.map((sv) => (
                    <div key={sv.variableId} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">
                        {sv.variable.name}
                        <span className="ml-1.5 font-mono font-normal text-muted-foreground">
                          {sv.variable.envVariable}
                        </span>
                      </label>
                      <input
                        className={inputClass(true)}
                        placeholder={sv.variable.defaultValue ?? ""}
                        value={variableValues[sv.variable.envVariable] ?? ""}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [sv.variable.envVariable]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateVarsMutation.mutate({ id: serverId, variables: variableValues, startup })}
                disabled={updateVarsMutation.isPending}
                className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {updateVarsMutation.isPending ? tc("saving") : t("saveStartup")}
              </button>
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-3">
            <DangerZone title={t("dangerZone")}>
              <DangerZoneRow
                title={isSuspended ? t("unsuspendTitle") : t("suspendTitle")}
                description={isSuspended ? t("unsuspendDesc") : t("suspendDesc")}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => suspendMutation.mutate({ id: serverId, suspended: !isSuspended })}
                  disabled={suspendMutation.isPending}
                >
                  {suspendMutation.isPending ? "..." : isSuspended ? t("unsuspend") : t("suspend")}
                </Button>
              </DangerZoneRow>

              <DangerZoneRow title={t("reinstallTitle")} description={t("reinstallDesc")}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reinstallMutation.mutate({ serverId })}
                  disabled={reinstallMutation.isPending}
                >
                  {reinstallMutation.isPending ? t("reinstalling") : t("reinstall")}
                </Button>
              </DangerZoneRow>

              <DangerZoneRow title={t("deleteServerTitle")} description={t("deleteServerDesc")}>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  {tc("delete")}
                </Button>
              </DangerZoneRow>
            </DangerZone>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={(open) => { setConfirmDelete(open); if (!open) setPurge(false); }}
              title={t("deleteConfirmTitle")}
              description={t("deleteConfirmDesc", { name: server.name })}
              confirmLabel={tc("delete")}
              destructive
              onConfirm={() => deleteMutation.mutate({ id: serverId, purgeData: purge })}
              loading={deleteMutation.isPending}
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={purge}
                  onChange={(e) => setPurge(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                {t("purgeData")}
              </label>
            </ConfirmDialog>
          </div>
        )}
        </motion.div>
      </div>
    </>
  );
}
