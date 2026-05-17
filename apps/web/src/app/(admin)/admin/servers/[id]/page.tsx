"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Monitor } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateServer(id: string) {
  void queryClient.invalidateQueries(orpc.servers.get.queryOptions({ input: { id } }));
}

function invalidateList() {
  void queryClient.invalidateQueries({ queryKey: orpc.servers.key() });
}

export default function AdminServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const router = useRouter();

  const { data: server, isLoading } = useQuery(
    orpc.servers.get.queryOptions({ input: { id: serverId } }),
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

  // Identity fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

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

      <div className="flex-1 overflow-auto">
        {/* Identity */}
        <section className="border-b border-[#222222] p-4">
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
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div>
              <p className="mb-1 text-[11px] text-[#555555]">UUID</p>
              <p className="font-mono text-xs text-[#444444]">{server.uuid}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-[#555555]">Node</p>
              <p className="text-sm text-[#888888]">{(server as { node?: { name: string } }).node?.name ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-[#555555]">Allocation</p>
              <p className="font-mono text-sm text-[#888888]">
                {server.allocation?.ip}:{server.allocation?.port}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-[#555555]">Egg</p>
              <p className="text-sm text-[#888888]">{server.egg?.name ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateMutation.mutate({ id: serverId, name, description })}
              disabled={updateMutation.isPending}
              className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
            {updateMutation.isSuccess && <span className="text-xs text-[#22c55e]">Saved</span>}
            {updateMutation.isError && (
              <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>
            )}
          </div>
        </section>

        {/* Resources */}
        <section className="border-b border-[#222222] p-4">
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
            {updateMutation.isSuccess && <span className="text-xs text-[#22c55e]">Saved</span>}
            {updateMutation.isError && (
              <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>
            )}
          </div>
        </section>

        {/* Startup & Variables */}
        <section className="border-b border-[#222222] p-4">
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

        {/* Danger Zone */}
        <section className="p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-[#f43f5e]/60">
            Danger Zone
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                updateMutation.mutate({ id: serverId, suspended: !isSuspended })
              }
              disabled={updateMutation.isPending}
              className="border border-[#555555] px-4 py-1.5 text-sm font-medium text-[#888888] transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {isSuspended ? "Unsuspend" : "Suspend"}
            </button>
            <button
              type="button"
              onClick={() => reinstallMutation.mutate({ serverId })}
              disabled={reinstallMutation.isPending}
              className="border border-[#555555] px-4 py-1.5 text-sm font-medium text-[#888888] transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {reinstallMutation.isPending ? "Reinstalling..." : "Reinstall"}
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[#f43f5e]">
                  <input
                    type="checkbox"
                    checked={purge}
                    onChange={(e) => setPurge(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Purge data from node
                </label>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({ id: serverId, purgeData: purge })}
                  disabled={deleteMutation.isPending}
                  className="bg-[#f43f5e] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmDelete(false); setPurge(false); }}
                  className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="border border-[#f43f5e]/40 px-4 py-1.5 text-sm font-medium text-[#f43f5e] transition-opacity hover:opacity-80"
              >
                Delete Server
              </button>
            )}
          </div>
          {reinstallMutation.isSuccess && (
            <p className="mt-2 text-xs text-[#22c55e]">Reinstall triggered.</p>
          )}
          {reinstallMutation.isError && (
            <p className="mt-2 text-xs text-[#f43f5e]">{reinstallMutation.error.message}</p>
          )}
        </section>
      </div>
    </>
  );
}
