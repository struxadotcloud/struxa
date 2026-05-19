"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { Monitor, ChevronDown } from "lucide-react";
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

export default function AdminServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("general");

  const { data: server, isLoading } = useQuery(
    orpc.servers.adminGet.queryOptions({ input: { id: serverId } }),
  );

  const { data: nodesList } = useQuery(orpc.nodes.list.queryOptions());

  // Track locally selected nodeId so allocation list updates when node changes
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

  // General fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [allocationId, setAllocationId] = useState("");

  // Resource fields
  const [memory, setMemory] = useState(0);
  const [disk, setDisk] = useState(0);
  const [cpu, setCpu] = useState(0);
  const [swap, setSwap] = useState(0);
  const [io, setIo] = useState(500);
  const [threads, setThreads] = useState("");
  const [oomDisabled, setOomDisabled] = useState(false);
  const [image, setImage] = useState("");

  // Startup fields
  const [startup, setStartup] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Danger zone
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
      vals[sv.variable.envVariable] =
        sv.variableValue ?? sv.variable.defaultValue ?? "";
    }
    setVariableValues(vals);
  }, [server]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#555555]">
        Loading...
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#555555]">
        Server not found.
      </div>
    );
  }

  const isSuspended = server.suspended;
  const nodeChanged = selectedNodeId !== server.nodeId;

  // Allocations for current node: show free ones + the server's current allocation
  const filteredAllocations = allocations?.filter(
    (a) => !a.serverId || a.id === server.allocationId,
  ) ?? [];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Monitor className="h-4 w-4 text-[#555555]" />
          <Link
            href={"/admin/servers" as never}
            className="text-xs text-[#555555] transition-colors hover:text-white"
          >
            Servers
          </Link>
          <span className="text-xs text-[#333333]">/</span>
          <span className="text-sm text-white">{server.name}</span>
          {isSuspended && (
            <span className="border border-[#f43f5e]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#f43f5e]">
              Suspended
            </span>
          )}
        </div>
        <Link
          href={`/servers/${serverId}` as never}
          className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          View Server
        </Link>
      </header>

      {/* Tab bar */}
      <div className="flex shrink-0 items-end gap-0 border-b border-[#222222] px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm transition-colors ${
              tab === t.id
                ? "border-b border-white text-white"
                : "text-[#555555] hover:text-[#888888]"
            }`}
          >
            {t.label}
            {t.id === "startup" && server.serverVariables.length > 0 && (
              <span className="ml-1.5 text-xs text-[#444444]">
                {server.serverVariables.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* General Tab */}
        {tab === "general" && (
          <section className="p-4">
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">Identity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Name</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Description</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] text-[#555555]">Owner</label>
              <UserCombobox
                value={ownerId}
                onChange={setOwnerId}
                initialLabel={server.userId}
              />
            </div>

            <p className="mb-2 mt-5 text-[10px] uppercase tracking-widest text-[#555555]">
              Node & Allocation
            </p>

            {nodeChanged && (
              <div className="mb-3 border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-3 py-2 text-xs text-[#f59e0b]">
                Warning: changing the node does not migrate data on Wings. Ensure the server exists on the target node.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Node</label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex w-full items-center justify-between border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white focus:border-[#555555]"
                  >
                    <span>
                      {nodesList?.find((n) => n.id === selectedNodeId)?.name ?? "Select node"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 border border-[#333333] bg-[#0d0d0d]">
                    {(nodesList ?? []).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => {
                          setSelectedNodeId(n.id);
                          setAllocationId("");
                        }}
                        className="cursor-pointer text-sm text-white hover:bg-[#1a1a1a]"
                      >
                        {n.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Allocation</label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex w-full items-center justify-between border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white focus:border-[#555555]"
                  >
                    <span>
                      {filteredAllocations.find((a) => a.id === allocationId)
                        ? `${filteredAllocations.find((a) => a.id === allocationId)!.ip}:${filteredAllocations.find((a) => a.id === allocationId)!.port}`
                        : allocationId
                        ? `${server.allocation?.ip}:${server.allocation?.port}`
                        : "Select allocation"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 border border-[#333333] bg-[#0d0d0d]">
                    {filteredAllocations.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-[#555555]">
                        {selectedNodeId ? "No free allocations" : "Select a node first"}
                      </div>
                    ) : (
                      filteredAllocations.map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onClick={() => setAllocationId(a.id)}
                          className="cursor-pointer font-mono text-sm text-white hover:bg-[#1a1a1a]"
                        >
                          {a.ip}:{a.port}
                          {a.id === server.allocationId && (
                            <span className="ml-2 text-[10px] text-[#555555]">current</span>
                          )}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] text-[#555555]">UUID</p>
                <p className="font-mono text-xs text-[#444444]">{server.uuid}</p>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-[#555555]">Egg</p>
                <p className="text-sm text-[#888888]">{server.egg?.name ?? "—"}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({
                    id: serverId,
                    name,
                    description,
                    userId: ownerId || undefined,
                    nodeId: nodeChanged ? selectedNodeId : undefined,
                    allocationId: allocationId !== server.allocationId ? allocationId : undefined,
                  })
                }
                disabled={updateMutation.isPending}
                className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
              {updateMutation.isSuccess && (
                <span className="text-xs text-[#22c55e]">Saved</span>
              )}
              {updateMutation.isError && (
                <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>
              )}
            </div>
          </section>
        )}

        {/* Resources Tab */}
        {tab === "resources" && (
          <section className="p-4">
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">Resources</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Memory (MB)</label>
                <input
                  type="number"
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={memory}
                  onChange={(e) => setMemory(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Disk (MB)</label>
                <input
                  type="number"
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={disk}
                  onChange={(e) => setDisk(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">CPU (%)</label>
                <input
                  type="number"
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={cpu}
                  onChange={(e) => setCpu(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">Swap (MB)</label>
                <input
                  type="number"
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={swap}
                  onChange={(e) => setSwap(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">IO Weight</label>
                <input
                  type="number"
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                  value={io}
                  onChange={(e) => setIo(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#555555]">CPU Threads</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="0,1,2 (leave blank for all)"
                  value={threads}
                  onChange={(e) => setThreads(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] text-[#555555]">Docker Image</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-[#888888]">
              <input
                type="checkbox"
                checked={oomDisabled}
                onChange={(e) => setOomDisabled(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Disable OOM Killer
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({
                    id: serverId,
                    memory,
                    disk,
                    cpu,
                    swap,
                    io,
                    threads: threads || null,
                    oomDisabled,
                    image,
                  })
                }
                disabled={updateMutation.isPending}
                className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {updateMutation.isPending ? "Saving..." : "Save Resources"}
              </button>
              {updateMutation.isSuccess && (
                <span className="text-xs text-[#22c55e]">Saved</span>
              )}
              {updateMutation.isError && (
                <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>
              )}
            </div>
          </section>
        )}

        {/* Startup Tab */}
        {tab === "startup" && (
          <section className="p-4">
            <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">
              Startup & Variables
            </p>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Startup Command</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={startup}
                onChange={(e) => setStartup(e.target.value)}
              />
            </div>
            {server.serverVariables.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] text-[#555555]">Variables</p>
                <div className="grid grid-cols-2 gap-2">
                  {server.serverVariables.map((sv) => (
                    <div key={sv.variableId}>
                      <label className="mb-1 block text-[10px] font-mono text-[#444444]">
                        {sv.variable.envVariable}
                        <span className="ml-2 font-sans normal-case text-[#333333]">
                          {sv.variable.name}
                        </span>
                      </label>
                      <input
                        className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none placeholder:text-[#333333] focus:border-[#555555]"
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
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateVarsMutation.mutate({
                    id: serverId,
                    variables: variableValues,
                    startup,
                  })
                }
                disabled={updateVarsMutation.isPending}
                className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {updateVarsMutation.isPending ? "Saving..." : "Save Startup"}
              </button>
              {updateVarsMutation.isSuccess && (
                <span className="text-xs text-[#22c55e]">Saved — invocation recomputed</span>
              )}
              {updateVarsMutation.isError && (
                <span className="text-xs text-[#f43f5e]">{updateVarsMutation.error.message}</span>
              )}
            </div>
          </section>
        )}

        {/* Danger Tab */}
        {tab === "danger" && (
          <section className="space-y-3 p-4">
            <p className="text-[10px] uppercase tracking-widest text-[#f43f5e]/60">Danger Zone</p>

            {/* Suspend */}
            <div className="flex items-center justify-between border border-[#222222] p-4">
              <div>
                <p className="text-sm text-white">
                  {isSuspended ? "Unsuspend Server" : "Suspend Server"}
                </p>
                <p className="mt-0.5 text-xs text-[#555555]">
                  {isSuspended
                    ? "Allow users to access and start this server again."
                    : "Immediately stop the server and prevent users from starting or accessing it."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  suspendMutation.mutate({ id: serverId, suspended: !isSuspended })
                }
                disabled={suspendMutation.isPending}
                className={`px-4 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40 ${
                  isSuspended
                    ? "bg-white text-black hover:opacity-80"
                    : "border border-[#f43f5e]/40 text-[#f43f5e] hover:opacity-80"
                }`}
              >
                {suspendMutation.isPending ? "..." : isSuspended ? "Unsuspend" : "Suspend"}
              </button>
            </div>

            {/* Reinstall */}
            <div className="flex items-center justify-between border border-[#222222] p-4">
              <div>
                <p className="text-sm text-white">Reinstall Server</p>
                <p className="mt-0.5 text-xs text-[#555555]">
                  Wipe and re-run the install script. Server data may be lost.
                </p>
              </div>
              <button
                type="button"
                onClick={() => reinstallMutation.mutate({ serverId })}
                disabled={reinstallMutation.isPending}
                className="border border-[#555555] px-4 py-1.5 text-sm font-medium text-[#888888] transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {reinstallMutation.isPending ? "Reinstalling..." : "Reinstall"}
              </button>
            </div>
            {reinstallMutation.isSuccess && (
              <p className="text-xs text-[#22c55e]">Reinstall triggered.</p>
            )}
            {reinstallMutation.isError && (
              <p className="text-xs text-[#f43f5e]">{reinstallMutation.error.message}</p>
            )}

            {/* Delete */}
            <div className="flex items-center justify-between border border-[#222222] p-4">
              <div>
                <p className="text-sm text-white">Delete Server</p>
                <p className="mt-0.5 text-xs text-[#555555]">
                  Permanently remove this server and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="border border-[#f43f5e]/40 px-4 py-1.5 text-sm font-medium text-[#f43f5e] transition-opacity hover:opacity-80"
              >
                Delete
              </button>
            </div>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={(open) => {
                setConfirmDelete(open);
                if (!open) setPurge(false);
              }}
              title="Delete server?"
              description={`This will permanently delete "${server.name}". This action cannot be undone.`}
              confirmLabel="Delete"
              destructive
              onConfirm={() => deleteMutation.mutate({ id: serverId, purgeData: purge })}
              loading={deleteMutation.isPending}
            >
              <label className="flex cursor-pointer items-center gap-2 text-xs text-[#888888]">
                <input
                  type="checkbox"
                  checked={purge}
                  onChange={(e) => setPurge(e.target.checked)}
                  className="h-3 w-3"
                />
                Purge data from node
              </label>
            </ConfirmDialog>
          </section>
        )}
      </div>
    </>
  );
}
