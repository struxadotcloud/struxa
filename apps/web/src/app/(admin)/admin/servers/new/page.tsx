"use client";

import { useState, useEffect } from "react";
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
import { Monitor, ChevronRight, ChevronDown } from "lucide-react";
import { orpc } from "@/utils/orpc";
import { UserCombobox } from "@/components/user-combobox";

const STEPS = [
  "Basic Info",
  "Node & Allocation",
  "Nest & Egg",
  "Resources",
  "Startup Variables",
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 border-b border-[#222222]">
      {STEPS.map((label, i) => (
        <div
          key={label}
          className={`flex items-center gap-2 border-r border-[#222222] px-4 py-2.5 text-xs ${
            i === current
              ? "bg-[#141414] text-white"
              : i < current
              ? "text-[#22c55e]"
              : "text-[#444444]"
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
              i < current
                ? "bg-[#22c55e] text-black"
                : i === current
                ? "bg-white text-black"
                : "bg-[#222222] text-[#555555]"
            }`}
          >
            {i + 1}
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}

export default function NewServerPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [basicInfo, setBasicInfo] = useState({
    name: "",
    description: "",
    userId: "",
  });

  const [nodeAlloc, setNodeAlloc] = useState({
    nodeId: "",
    allocationId: "",
  });

  const [nestEgg, setNestEgg] = useState({
    nestId: "",
    eggId: "",
    image: "",
  });

  const [resources, setResources] = useState({
    memory: 1024,
    disk: 10240,
    cpu: 100,
    swap: 0,
    io: 500,
    threads: "",
    oomDisabled: false,
  });

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [startOnCompletion, setStartOnCompletion] = useState(true);
  const [skipScripts, setSkipScripts] = useState(false);

  const createMutation = useMutation(
    orpc.servers.create.mutationOptions({
      onSuccess: () => {
        router.push("/admin/servers" as never);
      },
    }),
  );

  const { data: nodes } = useQuery(orpc.nodes.list.queryOptions());
  const { data: allocations } = useQuery(
    orpc.allocations.listByNode.queryOptions({
      input: nodeAlloc.nodeId ? { nodeId: nodeAlloc.nodeId } : skipToken,
    }),
  );
  const { data: nests } = useQuery(orpc.nests.list.queryOptions());
  const { data: eggs } = useQuery(
    orpc.eggs.listByNest.queryOptions({
      input: nestEgg.nestId ? { nestId: nestEgg.nestId } : skipToken,
    }),
  );
  const { data: selectedEgg } = useQuery(
    orpc.eggs.get.queryOptions({
      input: nestEgg.eggId ? { id: nestEgg.eggId } : skipToken,
    }),
  );

  useEffect(() => {
    if (!selectedEgg) return;
    setVariableValues((prev) => {
      const next = { ...prev };
      for (const v of selectedEgg.variables) {
        if (!(v.envVariable in next)) {
          next[v.envVariable] = v.defaultValue ?? "";
        }
      }
      return next;
    });
  }, [selectedEgg]);

  const freeAllocations = allocations?.filter((a) => !a.serverId) ?? [];

  function canProceed() {
    if (step === 0) return basicInfo.name.trim().length > 0 && basicInfo.userId.trim().length > 0;
    if (step === 1) return !!nodeAlloc.nodeId && !!nodeAlloc.allocationId;
    if (step === 2) return !!nestEgg.eggId && !!nestEgg.image;
    if (step === 3) return resources.memory > 0 && resources.disk > 0;
    return true;
  }

  async function handleSubmit() {
    await createMutation.mutateAsync({
      name: basicInfo.name,
      description: basicInfo.description || undefined,
      userId: basicInfo.userId,
      nodeId: nodeAlloc.nodeId,
      allocationId: nodeAlloc.allocationId,
      eggId: nestEgg.eggId,
      image: nestEgg.image,
      memory: resources.memory,
      disk: resources.disk,
      cpu: resources.cpu,
      swap: resources.swap,
      io: resources.io,
      threads: resources.threads || undefined,
      oomDisabled: resources.oomDisabled,
      startOnCompletion,
      skipScripts,
      variableValues,
    });
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href={"/admin/servers" as never} className="text-[#555555] transition-colors hover:text-white">
            Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Monitor className="h-3.5 w-3.5 text-[#555555]" />
          <span className="text-white">New Server</span>
        </div>
      </header>

      <StepIndicator current={step} />

      <div className="flex-1 overflow-auto p-6">
        {step === 0 && (
          <div className="max-w-xl">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#555555]">Basic Information</p>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Server Name *</label>
                <input
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="My Minecraft Server"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Description</label>
                <input
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="Optional description"
                  value={basicInfo.description}
                  onChange={(e) => setBasicInfo((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Owner *</label>
                <UserCombobox
                  value={basicInfo.userId}
                  onChange={(id) => setBasicInfo((f) => ({ ...f, userId: id }))}
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="max-w-xl">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#555555]">Node & Allocation</p>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Node *</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                    <span className={nodeAlloc.nodeId ? "text-white" : "text-[#444444]"}>
                      {nodeAlloc.nodeId ? (nodes?.find((n) => n.id === nodeAlloc.nodeId)?.name ?? "Select a node...") : "Select a node..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                    {nodes?.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => setNodeAlloc({ nodeId: n.id, allocationId: "" })}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeAlloc.nodeId === n.id ? "bg-[#22c55e]" : "bg-transparent"}`} />
                        {n.name} <span className="text-[#444444]">({n.fqdn})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {nodeAlloc.nodeId && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                    Allocation * ({freeAllocations.length} available)
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#141414] px-3 py-2 font-mono text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                      <span className={nodeAlloc.allocationId ? "text-white" : "text-[#444444]"}>
                        {nodeAlloc.allocationId
                          ? (() => { const a = freeAllocations.find((a) => a.id === nodeAlloc.allocationId); return a ? `${a.ip}:${a.port}` : "Select an allocation..."; })()
                          : "Select an allocation..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                      {freeAllocations.map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onClick={() => setNodeAlloc((f) => ({ ...f, allocationId: a.id }))}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 font-mono text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeAlloc.allocationId === a.id ? "bg-[#22c55e]" : "bg-transparent"}`} />
                          {a.ip}:{a.port}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {freeAllocations.length === 0 && (
                    <p className="text-xs text-[#f43f5e]">
                      No free allocations. Add some in the node management page.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#555555]">Nest & Egg</p>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Nest *</label>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                    <span className={nestEgg.nestId ? "text-white" : "text-[#444444]"}>
                      {nestEgg.nestId ? (nests?.find((n) => n.id === nestEgg.nestId)?.name ?? "Select a nest...") : "Select a nest..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                    {nests?.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => setNestEgg({ nestId: n.id, eggId: "", image: "" })}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.nestId === n.id ? "bg-[#22c55e]" : "bg-transparent"}`} />
                        {n.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {nestEgg.nestId && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">Egg *</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                      <span className={nestEgg.eggId ? "text-white" : "text-[#444444]"}>
                        {nestEgg.eggId ? (eggs?.find((egg) => egg.id === nestEgg.eggId)?.name ?? "Select an egg...") : "Select an egg..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                      {eggs?.map((egg) => (
                        <DropdownMenuItem
                          key={egg.id}
                          onClick={() => {
                            const dockerImages = egg.dockerImages
                              ? (JSON.parse(egg.dockerImages) as Record<string, string>)
                              : {};
                            const firstImage = Object.values(dockerImages)[0] ?? "";
                            setNestEgg((f) => ({ ...f, eggId: egg.id, image: firstImage }));
                          }}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.eggId === egg.id ? "bg-[#22c55e]" : "bg-transparent"}`} />
                          {egg.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {nestEgg.eggId && selectedEgg && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                    Docker Image *
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-between border border-[#333333] bg-[#141414] px-3 py-2 font-mono text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
                      <span className={nestEgg.image ? "truncate text-white" : "text-[#444444]"}>
                        {nestEgg.image
                          ? (Object.entries(JSON.parse(selectedEgg.dockerImages ?? "{}") as Record<string, string>).find(([, img]) => img === nestEgg.image)?.[0] || nestEgg.image)
                          : "Select an image..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={2} className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl">
                      {Object.entries(
                        JSON.parse(selectedEgg.dockerImages ?? "{}") as Record<string, string>,
                      ).map(([alias, img]) => (
                        <DropdownMenuItem
                          key={img}
                          onClick={() => setNestEgg((f) => ({ ...f, image: img }))}
                          className="flex cursor-pointer items-center gap-2.5 px-3 py-2 font-mono text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.image === img ? "bg-[#22c55e]" : "bg-transparent"}`} />
                          {alias || img}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {selectedEgg.description && (
                    <p className="mt-1 text-xs text-[#555555]">{selectedEgg.description}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-xl">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#555555]">Resource Limits</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Memory (MB) *</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={resources.memory}
                  onChange={(e) => setResources((r) => ({ ...r, memory: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Disk (MB) *</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={resources.disk}
                  onChange={(e) => setResources((r) => ({ ...r, disk: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">CPU Limit (%)</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={resources.cpu}
                  onChange={(e) => setResources((r) => ({ ...r, cpu: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Swap (MB, -1=unlimited)</label>
                <input
                  type="number"
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={resources.swap}
                  onChange={(e) => setResources((r) => ({ ...r, swap: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">Block IO Weight (10-1000)</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  className="border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={resources.io}
                  onChange={(e) => setResources((r) => ({ ...r, io: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-[#555555]">CPU Threads (optional)</label>
                <input
                  className="border border-[#333333] bg-[#141414] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                  placeholder="0,1,2"
                  value={resources.threads}
                  onChange={(e) => setResources((r) => ({ ...r, threads: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm text-[#888888]">
                <input
                  type="checkbox"
                  checked={resources.oomDisabled}
                  onChange={(e) => setResources((r) => ({ ...r, oomDisabled: e.target.checked }))}
                  className="h-3.5 w-3.5"
                />
                Disable OOM Killer
              </label>
              <label className="flex items-center gap-2 text-sm text-[#888888]">
                <input
                  type="checkbox"
                  checked={startOnCompletion}
                  onChange={(e) => setStartOnCompletion(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Start server on completion
              </label>
              <label className="flex items-center gap-2 text-sm text-[#888888]">
                <input
                  type="checkbox"
                  checked={skipScripts}
                  onChange={(e) => setSkipScripts(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Skip install scripts
              </label>
            </div>
          </div>
        )}

        {step === 4 && selectedEgg && (
          <div className="max-w-xl">
            <p className="mb-1 text-xs uppercase tracking-widest text-[#555555]">Startup Variables</p>
            {selectedEgg.startup && (
              <p className="mb-4 font-mono text-xs text-[#444444]">{selectedEgg.startup}</p>
            )}
            {selectedEgg.variables.length === 0 && (
              <p className="text-sm text-[#555555]">No variables for this egg.</p>
            )}
            <div className="grid gap-4">
              {selectedEgg.variables.map((v) => (
                <div key={v.id} className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                    {v.name}
                    {v.rules && (
                      <span className="ml-2 normal-case text-[#444444]">({v.rules})</span>
                    )}
                  </label>
                  <input
                    className="border border-[#333333] bg-[#141414] px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                    placeholder={v.defaultValue ?? ""}
                    value={variableValues[v.envVariable] ?? ""}
                    onChange={(e) =>
                      setVariableValues((vals) => ({ ...vals, [v.envVariable]: e.target.value }))
                    }
                  />
                  {v.description && (
                    <p className="text-xs text-[#444444]">{v.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && !selectedEgg && (
          <p className="text-sm text-[#555555]">Loading egg variables...</p>
        )}

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="bg-neutral-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-[#22c55e] px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {createMutation.isPending ? "Creating..." : "Create Server"}
            </button>
          )}
          {createMutation.isError && (
            <span className="text-xs text-[#f43f5e]">{createMutation.error.message}</span>
          )}
        </div>
      </div>
    </>
  );
}
