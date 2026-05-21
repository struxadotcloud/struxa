"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { skipToken } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
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
    <div className="flex items-center gap-2 border-b border-border bg-card px-6 py-4 overflow-x-auto">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                i < current
                  ? "bg-green-500 text-white"
                  : i === current
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                i === current ? "text-foreground" : i < current ? "text-green-500" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-1" />
          )}
        </div>
      ))}
    </div>
  );
}

function dropdownTriggerClass() {
  return "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring";
}

function dropdownContentClass() {
  return "rounded-xl border border-border bg-card p-1 shadow-lg";
}

function dropdownItemClass() {
  return "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground";
}

function inputClass(mono?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${mono ? " font-mono" : ""}`;
}

export default function NewServerPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [basicInfo, setBasicInfo] = useState({ name: "", description: "", userId: "" });
  const [nodeAlloc, setNodeAlloc] = useState({ nodeId: "", allocationId: "" });
  const [nestEgg, setNestEgg] = useState({ nestId: "", eggId: "", image: "" });
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
      onSuccess: () => { router.push("/admin/servers" as never); },
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
      <StepIndicator current={step} />

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-lg">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Server Name <span className="text-destructive">*</span></label>
                <input
                  className={inputClass()}
                  placeholder="My Minecraft Server"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Description</label>
                <input
                  className={inputClass()}
                  placeholder="Optional description"
                  value={basicInfo.description}
                  onChange={(e) => setBasicInfo((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Owner <span className="text-destructive">*</span></label>
                <UserCombobox
                  value={basicInfo.userId}
                  onChange={(id) => setBasicInfo((f) => ({ ...f, userId: id }))}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Node <span className="text-destructive">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger className={dropdownTriggerClass()}>
                    <span className={nodeAlloc.nodeId ? "text-foreground" : "text-muted-foreground/50"}>
                      {nodeAlloc.nodeId ? (nodes?.find((n) => n.id === nodeAlloc.nodeId)?.name ?? "Select a node...") : "Select a node..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className={dropdownContentClass()}>
                    {nodes?.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => setNodeAlloc({ nodeId: n.id, allocationId: "" })}
                        className={dropdownItemClass()}
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeAlloc.nodeId === n.id ? "bg-green-500" : "bg-transparent"}`} />
                        {n.name} <span className="text-muted-foreground/50">({n.fqdn})</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {nodeAlloc.nodeId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Allocation <span className="text-destructive">*</span>
                    <span className="ml-1.5 font-normal text-muted-foreground">({freeAllocations.length} available)</span>
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`${dropdownTriggerClass()} font-mono`}>
                      <span className={nodeAlloc.allocationId ? "text-foreground" : "text-muted-foreground/50"}>
                        {nodeAlloc.allocationId
                          ? (() => { const a = freeAllocations.find((a) => a.id === nodeAlloc.allocationId); return a ? `${a.ip}:${a.port}` : "Select..."; })()
                          : "Select an allocation..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={4} className={dropdownContentClass()}>
                      {freeAllocations.map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onClick={() => setNodeAlloc((f) => ({ ...f, allocationId: a.id }))}
                          className={`${dropdownItemClass()} font-mono`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nodeAlloc.allocationId === a.id ? "bg-green-500" : "bg-transparent"}`} />
                          {a.ip}:{a.port}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {freeAllocations.length === 0 && (
                    <p className="text-xs text-destructive">
                      No free allocations. Add some in the node management page.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Nest <span className="text-destructive">*</span></label>
                <DropdownMenu>
                  <DropdownMenuTrigger className={dropdownTriggerClass()}>
                    <span className={nestEgg.nestId ? "text-foreground" : "text-muted-foreground/50"}>
                      {nestEgg.nestId ? (nests?.find((n) => n.id === nestEgg.nestId)?.name ?? "Select a nest...") : "Select a nest..."}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4} className={dropdownContentClass()}>
                    {nests?.map((n) => (
                      <DropdownMenuItem key={n.id} onClick={() => setNestEgg({ nestId: n.id, eggId: "", image: "" })} className={dropdownItemClass()}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.nestId === n.id ? "bg-green-500" : "bg-transparent"}`} />
                        {n.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {nestEgg.nestId && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Egg <span className="text-destructive">*</span></label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={dropdownTriggerClass()}>
                      <span className={nestEgg.eggId ? "text-foreground" : "text-muted-foreground/50"}>
                        {nestEgg.eggId ? (eggs?.find((e) => e.id === nestEgg.eggId)?.name ?? "Select an egg...") : "Select an egg..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={4} className={dropdownContentClass()}>
                      {eggs?.map((egg) => (
                        <DropdownMenuItem
                          key={egg.id}
                          onClick={() => {
                            const dockerImages = egg.dockerImages ? (JSON.parse(egg.dockerImages) as Record<string, string>) : {};
                            const firstImage = Object.values(dockerImages)[0] ?? "";
                            setNestEgg((f) => ({ ...f, eggId: egg.id, image: firstImage }));
                          }}
                          className={dropdownItemClass()}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.eggId === egg.id ? "bg-green-500" : "bg-transparent"}`} />
                          {egg.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {nestEgg.eggId && selectedEgg && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Docker Image <span className="text-destructive">*</span></label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`${dropdownTriggerClass()} font-mono`}>
                      <span className={nestEgg.image ? "truncate text-foreground" : "text-muted-foreground/50"}>
                        {nestEgg.image
                          ? (Object.entries(JSON.parse(selectedEgg.dockerImages ?? "{}") as Record<string, string>).find(([, img]) => img === nestEgg.image)?.[0] || nestEgg.image)
                          : "Select an image..."}
                      </span>
                      <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={4} className={dropdownContentClass()}>
                      {Object.entries(JSON.parse(selectedEgg.dockerImages ?? "{}") as Record<string, string>).map(([alias, img]) => (
                        <DropdownMenuItem key={img} onClick={() => setNestEgg((f) => ({ ...f, image: img }))} className={`${dropdownItemClass()} font-mono`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${nestEgg.image === img ? "bg-green-500" : "bg-transparent"}`} />
                          {alias || img}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {selectedEgg.description && (
                    <p className="text-xs text-muted-foreground">{selectedEgg.description}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Memory (MB)", key: "memory", value: resources.memory },
                  { label: "Disk (MB)", key: "disk", value: resources.disk },
                  { label: "CPU Limit (%)", key: "cpu", value: resources.cpu },
                  { label: "Swap (MB, -1=unlimited)", key: "swap", value: resources.swap },
                  { label: "Block IO Weight (10-1000)", key: "io", value: resources.io },
                ].map(({ label, key, value }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{label}</label>
                    <input
                      type="number"
                      className={inputClass()}
                      value={value}
                      onChange={(e) => setResources((r) => ({ ...r, [key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">CPU Threads</label>
                  <input
                    className={inputClass(true)}
                    placeholder="0,1,2 (blank = all)"
                    value={resources.threads}
                    onChange={(e) => setResources((r) => ({ ...r, threads: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { checked: resources.oomDisabled, key: "oomDisabled", label: "Disable OOM Killer" },
                  { checked: startOnCompletion, label: "Start server on completion" },
                  { checked: skipScripts, label: "Skip install scripts" },
                ].map(({ checked, key, label }) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (key === "oomDisabled") setResources((r) => ({ ...r, oomDisabled: e.target.checked }));
                        else if (label.includes("Start")) setStartOnCompletion(e.target.checked);
                        else setSkipScripts(e.target.checked);
                      }}
                      className="h-3.5 w-3.5 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && selectedEgg && (
            <div className="flex flex-col gap-4">
              {selectedEgg.startup && (
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Startup Command</p>
                  <p className="font-mono text-xs text-foreground">{selectedEgg.startup}</p>
                </div>
              )}
              {selectedEgg.variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No variables for this egg.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedEgg.variables.map((v) => (
                    <div key={v.id} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">
                        {v.name}
                        {v.rules && <span className="ml-1.5 font-normal text-muted-foreground">({v.rules})</span>}
                      </label>
                      <input
                        className={inputClass(true)}
                        placeholder={v.defaultValue ?? ""}
                        value={variableValues[v.envVariable] ?? ""}
                        onChange={(e) => setVariableValues((vals) => ({ ...vals, [v.envVariable]: e.target.value }))}
                      />
                      {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && !selectedEgg && (
            <p className="text-sm text-muted-foreground">Loading egg variables...</p>
          )}

          <div className="mt-8 flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="rounded-lg bg-green-500 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {createMutation.isPending ? "Creating..." : "Create Server"}
              </button>
            )}
            {createMutation.isError && (
              <span className="text-xs text-destructive">{createMutation.error.message}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
