"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { UserCombobox } from "@/components/user-combobox";
import { ConfirmDialog } from "@/components/confirm-dialog";

type Tab = "general" | "resources" | "startup" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "resources", label: "Resources" },
  { id: "startup", label: "Startup" },
  { id: "danger", label: "Danger" },
];

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
    <div className="rounded-xl border border-border bg-card shadow-sm">
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

  const [tab, setTab] = useState<Tab>("general");

  const { data: server, isLoading } = useQuery(
    orpc.servers.adminGet.queryOptions({ input: { id: serverId } }),
  );

  const { data: nodesList } = useQuery(orpc.nodes.list.queryOptions());

  const [selectedNodeId, setSelectedNodeId] = useState("");
  const { data: allocations } = useQuery(
    orpc.allocations.listByNode.queryOptions({
      input: selectedNodeId ? { nodeId: selectedNodeId } : skipToken,
    }),
  );

  const updateMutation = useMutation(
    orpc.servers.update.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        invalidateList();
      },
    }),
  );

  const updateVarsMutation = useMutation(
    orpc.servers.updateVariables.mutationOptions({
      onSuccess: () => invalidateServer(serverId),
    }),
  );

  const suspendMutation = useMutation(
    orpc.servers.suspend.mutationOptions({
      onSuccess: () => {
        invalidateServer(serverId);
        invalidateList();
      },
    }),
  );

  const reinstallMutation = useMutation(
    orpc.servers.reinstall.mutationOptions({
      onSuccess: () => invalidateServer(serverId),
    }),
  );

  const deleteMutation = useMutation(
    orpc.servers.delete.mutationOptions({
      onSuccess: () => {
        invalidateList();
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
        Loading...
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Server not found.
      </div>
    );
  }

  const isSuspended = server.suspended;
  const nodeChanged = selectedNodeId !== server.nodeId;

  const filteredAllocations = allocations?.filter(
    (a) => !a.serverId || a.id === server.allocationId,
  ) ?? [];

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
        {tab === "general" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <SectionCard title="Identity">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Name</label>
                  <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Description</label>
                  <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Owner</label>
                <UserCombobox value={ownerId} onChange={setOwnerId} initialLabel={server.userId} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">UUID</p>
                  <p className="font-mono text-xs text-muted-foreground">{server.uuid}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Egg</p>
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
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved</span>}
                {updateMutation.isError && <span className="text-xs text-destructive">{updateMutation.error.message}</span>}
              </div>
            </SectionCard>

            <SectionCard title="Node & Allocation">
              {nodeChanged && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  Warning: changing the node does not migrate data on Wings. Ensure the server exists on the target node.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Node</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                      <span>{nodesList?.find((n) => n.id === selectedNodeId)?.name ?? "Select node"}</span>
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
                  <label className="text-xs font-medium text-foreground">Allocation</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
                      <span>
                        {filteredAllocations.find((a) => a.id === allocationId)
                          ? `${filteredAllocations.find((a) => a.id === allocationId)!.ip}:${filteredAllocations.find((a) => a.id === allocationId)!.port}`
                          : allocationId
                          ? `${server.allocation?.ip}:${server.allocation?.port}`
                          : "Select allocation"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border border-border bg-card p-1 shadow-lg">
                      {filteredAllocations.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {selectedNodeId ? "No free allocations" : "Select a node first"}
                        </div>
                      ) : (
                        filteredAllocations.map((a) => (
                          <DropdownMenuItem
                            key={a.id}
                            onClick={() => setAllocationId(a.id)}
                            className="cursor-pointer rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
                          >
                            {a.ip}:{a.port}
                            {a.id === server.allocationId && (
                              <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 font-sans text-[10px] normal-case text-muted-foreground">current</span>
                            )}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "resources" && (
          <div className="mx-auto max-w-2xl">
            <SectionCard title="Resource Limits">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Memory (MB)", value: memory, set: setMemory },
                  { label: "Disk (MB)", value: disk, set: setDisk },
                  { label: "CPU (%)", value: cpu, set: setCpu },
                  { label: "Swap (MB)", value: swap, set: setSwap },
                  { label: "IO Weight", value: io, set: setIo },
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
                  <label className="text-xs font-medium text-foreground">CPU Threads</label>
                  <input
                    className={inputClass(true)}
                    placeholder="0,1,2 (blank = all)"
                    value={threads}
                    onChange={(e) => setThreads(e.target.value)}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Docker Image</label>
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
                Disable OOM Killer
              </label>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateMutation.mutate({ id: serverId, memory, disk, cpu, swap, io, threads: threads || null, oomDisabled, image })}
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Resources"}
                </button>
                {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved</span>}
                {updateMutation.isError && <span className="text-xs text-destructive">{updateMutation.error.message}</span>}
              </div>
            </SectionCard>
          </div>
        )}

        {tab === "startup" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <SectionCard title="Startup Command">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Command</label>
                <input className={inputClass(true)} value={startup} onChange={(e) => setStartup(e.target.value)} />
              </div>
            </SectionCard>

            {server.serverVariables.length > 0 && (
              <SectionCard title="Environment Variables">
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
                {updateVarsMutation.isPending ? "Saving..." : "Save Startup"}
              </button>
              {updateVarsMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved — invocation recomputed</span>}
              {updateVarsMutation.isError && <span className="text-xs text-destructive">{updateVarsMutation.error.message}</span>}
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-3">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-destructive/60">Danger Zone</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isSuspended ? "Unsuspend Server" : "Suspend Server"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isSuspended
                        ? "Allow users to access and start this server again."
                        : "Immediately stop the server and prevent user access."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => suspendMutation.mutate({ id: serverId, suspended: !isSuspended })}
                    disabled={suspendMutation.isPending}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40 ${
                      isSuspended
                        ? "bg-foreground text-background hover:opacity-80"
                        : "border border-destructive/40 text-destructive hover:bg-destructive/10"
                    }`}
                  >
                    {suspendMutation.isPending ? "..." : isSuspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Reinstall Server</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Wipe and re-run the install script. Server data may be lost.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reinstallMutation.mutate({ serverId })}
                    disabled={reinstallMutation.isPending}
                    className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {reinstallMutation.isPending ? "Reinstalling..." : "Reinstall"}
                  </button>
                </div>
                {reinstallMutation.isSuccess && (
                  <p className="text-xs font-medium text-green-500">Reinstall triggered.</p>
                )}
                {reinstallMutation.isError && (
                  <p className="text-xs text-destructive">{reinstallMutation.error.message}</p>
                )}

                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-card p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete Server</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Permanently remove this server. This cannot be undone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={(open) => { setConfirmDelete(open); if (!open) setPurge(false); }}
              title="Delete server?"
              description={`This will permanently delete "${server.name}". This action cannot be undone.`}
              confirmLabel="Delete"
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
                Purge data from node
              </label>
            </ConfirmDialog>
          </div>
        )}
      </div>
    </>
  );
}
