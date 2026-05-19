"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Egg, Package, Plus, Trash2 } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";

function invalidateEgg(eggId: string) {
  void queryClient.invalidateQueries(orpc.eggs.get.queryOptions({ input: { id: eggId } }));
}

type EggVariable = {
  id: string;
  name: string;
  description: string | null;
  envVariable: string;
  defaultValue: string | null;
  userViewable: boolean;
  userEditable: boolean;
  rules: string | null;
};

type DockerImage = { tag: string; alias: string };

function parseDockerImages(raw: string | null): DockerImage[] {
  try {
    const obj = JSON.parse(raw ?? "{}") as Record<string, string>;
    return Object.entries(obj).map(([tag, alias]) => ({ tag, alias }));
  } catch {
    return [];
  }
}

function serializeDockerImages(images: DockerImage[]): Record<string, string> {
  return Object.fromEntries(images.map(({ tag, alias }) => [tag, alias]));
}

function VariableRow({
  variable,
  eggId,
  onSaved,
  onDeleted,
}: {
  variable: EggVariable;
  eggId: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(variable.name);
  const [envVariable, setEnvVariable] = useState(variable.envVariable);
  const [defaultValue, setDefaultValue] = useState(variable.defaultValue ?? "");
  const [description, setDescription] = useState(variable.description ?? "");
  const [userViewable, setUserViewable] = useState(variable.userViewable);
  const [userEditable, setUserEditable] = useState(variable.userEditable);

  const updateMutation = useMutation(
    orpc.eggs.updateVariable.mutationOptions({ onSuccess: onSaved }),
  );
  const deleteMutation = useMutation(
    orpc.eggs.deleteVariable.mutationOptions({ onSuccess: onDeleted }),
  );

  const actions: ActionItem[] = [
    {
      label: "Delete Variable",
      icon: Trash2,
      onClick: () => deleteMutation.mutate({ variableId: variable.id }),
      destructive: true,
    },
  ];

  return (
    <ContextMenu items={actions}>
      {({ onContextMenu }) => (
        <div onContextMenu={onContextMenu} className="border-b border-[#222222] px-4 py-3 hover:bg-[#111111]">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#555555]">Name</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#555555]">Env Variable</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={envVariable}
                onChange={(e) => setEnvVariable(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#555555]">Default Value</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[#555555]">Description</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[#888888]">
              <input
                type="checkbox"
                checked={userViewable}
                onChange={(e) => setUserViewable(e.target.checked)}
                className="h-4 w-4"
              />
              User Viewable
            </label>
            <label className="flex items-center gap-2 text-sm text-[#888888]">
              <input
                type="checkbox"
                checked={userEditable}
                onChange={(e) => setUserEditable(e.target.checked)}
                className="h-4 w-4"
              />
              User Editable
            </label>
            <div className="ml-auto flex items-center gap-2">
              {updateMutation.isSuccess && <span className="text-xs text-[#22c55e]">Saved</span>}
              {updateMutation.isError && <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>}
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({
                    variableId: variable.id,
                    name,
                    envVariable,
                    defaultValue,
                    description,
                    userViewable,
                    userEditable,
                  })
                }
                disabled={updateMutation.isPending}
                className="bg-white px-4 py-1.5 text-xs font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
              <RowMenu items={actions} />
            </div>
          </div>
        </div>
      )}
    </ContextMenu>
  );
}

type Tab = "general" | "environment" | "installer" | "variables";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "environment", label: "Environment" },
  { id: "installer", label: "Installer" },
  { id: "variables", label: "Variables" },
];

export default function EggDetailPage({
  params,
}: {
  params: Promise<{ id: string; eggId: string }>;
}) {
  const { id: nestId, eggId } = use(params);
  const { data: nests } = useQuery(orpc.nests.list.queryOptions());
  const { data: egg, isLoading } = useQuery(
    orpc.eggs.get.queryOptions({ input: { id: eggId } }),
  );

  const nest = nests?.find((n) => n.id === nestId);

  const updateMutation = useMutation(
    orpc.eggs.update.mutationOptions({ onSuccess: () => invalidateEgg(eggId) }),
  );
  const addVariableMutation = useMutation(
    orpc.eggs.addVariable.mutationOptions({ onSuccess: () => invalidateEgg(eggId) }),
  );

  const [tab, setTab] = useState<Tab>("general");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startup, setStartup] = useState("");
  const [stopCommand, setStopCommand] = useState("");
  const [startupDetection, setStartupDetection] = useState<string[]>([]);
  const [newDetection, setNewDetection] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState("");
  const [dockerImages, setDockerImages] = useState<DockerImage[]>([]);
  const [scriptInstall, setScriptInstall] = useState("");
  const [scriptEntry, setScriptEntry] = useState("bash");
  const [scriptContainer, setScriptContainer] = useState("");
  const [scriptExtension, setScriptExtension] = useState("sh");

  const [newVarName, setNewVarName] = useState("");
  const [newVarEnv, setNewVarEnv] = useState("");
  const [newVarDefault, setNewVarDefault] = useState("");

  useEffect(() => {
    if (egg) {
      setName(egg.name);
      setDescription(egg.description ?? "");
      setStartup(egg.startup);
      setStopCommand(egg.stopCommand ?? "");
      setDockerImages(parseDockerImages(egg.dockerImages));
      setScriptInstall(egg.scriptInstall ?? "");
      setScriptEntry(egg.scriptEntry ?? "bash");
      setScriptContainer(egg.scriptContainer ?? "");
      setScriptExtension(egg.scriptExtension ?? "sh");

      try {
        const cs = JSON.parse(egg.configStartup ?? "{}") as { done?: string | string[] };
        if (cs.done) {
          setStartupDetection(Array.isArray(cs.done) ? cs.done : [cs.done]);
        }
      } catch { /* leave empty */ }

      try {
        const fs = JSON.parse(egg.features ?? "[]") as string[];
        setFeatures(Array.isArray(fs) ? fs : []);
      } catch { /* leave empty */ }
    }
  }, [egg]);

  async function handleSave() {
    const configStartup = startupDetection.length > 0
      ? JSON.stringify(startupDetection.length === 1 ? { done: startupDetection[0] } : { done: startupDetection })
      : undefined;

    await updateMutation.mutateAsync({
      id: eggId,
      name,
      description,
      startup,
      stopCommand,
      dockerImages: serializeDockerImages(dockerImages),
      configStartup,
      features,
      scriptInstall,
      scriptEntry,
      scriptContainer,
      scriptExtension,
    });
  }

  async function handleAddVariable() {
    if (!newVarName || !newVarEnv) return;
    await addVariableMutation.mutateAsync({
      eggId,
      name: newVarName,
      envVariable: newVarEnv,
      defaultValue: newVarDefault,
    });
    setNewVarName("");
    setNewVarEnv("");
    setNewVarDefault("");
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-[#555555]">Loading...</div>;
  }

  if (!egg) {
    return <div className="flex h-full items-center justify-center text-sm text-[#555555]">Egg not found.</div>;
  }

  const saveBar = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
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
  );

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href={"/admin/nests" as never} className="text-[#555555] transition-colors hover:text-white">
            Nests
          </Link>
          <span className="text-[#333333]">/</span>
          <Package className="h-3.5 w-3.5 text-[#555555]" />
          <Link
            href={`/admin/nests/${nestId}` as never}
            className="text-[#555555] transition-colors hover:text-white"
          >
            {nest?.name ?? nestId}
          </Link>
          <span className="text-[#333333]">/</span>
          <Egg className="h-3.5 w-3.5 text-[#555555]" />
          <span className="text-white">{egg.name}</span>
        </div>
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
            {t.id === "variables" && (
              <span className="ml-1.5 text-xs text-[#444444]">{egg.variables.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* General tab */}
        {tab === "general" && (
          <div className="p-6">
            <div className="grid max-w-2xl grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs text-[#555555]">Name</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#555555]">Description</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-[#555555]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#555555]">Startup Command</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                  value={startup}
                  onChange={(e) => setStartup(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#555555]">Stop Command</label>
                <input
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                  value={stopCommand}
                  onChange={(e) => setStopCommand(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-2 block text-xs text-[#555555]">
                  Running Detection
                  <span className="ml-2 text-[11px] text-[#444444]">
                    — Wings marks server as running when any pattern is found in console output
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {startupDetection.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 border border-[#333333] bg-[#111111] px-3 py-1.5">
                      <span className="font-mono text-sm text-white">{s}</span>
                      <button
                        type="button"
                        onClick={() => setStartupDetection((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-1 text-[#555555] transition-colors hover:text-[#f43f5e]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      className="w-80 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                      placeholder={`Done! For help, type "help"`}
                      value={newDetection}
                      onChange={(e) => setNewDetection(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDetection.trim()) {
                          setStartupDetection((prev) => [...prev, newDetection.trim()]);
                          setNewDetection("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newDetection.trim()) {
                          setStartupDetection((prev) => [...prev, newDetection.trim()]);
                          setNewDetection("");
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-[#555555] transition-colors hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">{saveBar}</div>
          </div>
        )}

        {/* Environment tab */}
        {tab === "environment" && (
          <div className="p-6">
            {/* Docker Images */}
            <div className="mb-8 max-w-2xl">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-[#555555]">Docker Images</label>
                <button
                  type="button"
                  onClick={() => setDockerImages((prev) => [...prev, { tag: "", alias: "" }])}
                  className="flex items-center gap-1 text-xs text-[#555555] transition-colors hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Image
                </button>
              </div>
              {dockerImages.length === 0 && (
                <p className="text-sm text-[#444444]">No Docker images configured.</p>
              )}
              {dockerImages.map((img, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input
                    className="flex-1 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    placeholder="ghcr.io/example/image:latest"
                    value={img.tag}
                    onChange={(e) => {
                      const updated = [...dockerImages];
                      updated[i] = { ...img, tag: e.target.value };
                      setDockerImages(updated);
                    }}
                  />
                  <input
                    className="w-48 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                    placeholder="Display name"
                    value={img.alias}
                    onChange={(e) => {
                      const updated = [...dockerImages];
                      updated[i] = { ...img, alias: e.target.value };
                      setDockerImages(updated);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setDockerImages((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[#555555] transition-colors hover:text-[#f43f5e]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="mb-8 max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <label className="text-xs uppercase tracking-wider text-[#555555]">Features</label>
                <span className="text-[11px] text-[#444444]">— Wings uses these to enable specific behaviors (e.g. eula, steam)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 border border-[#333333] bg-[#111111] px-3 py-1.5">
                    <span className="font-mono text-sm text-white">{f}</span>
                    <button
                      type="button"
                      onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-1 text-[#555555] transition-colors hover:text-[#f43f5e]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    className="w-44 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    placeholder="eula"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFeature.trim()) {
                        setFeatures((prev) => [...prev, newFeature.trim()]);
                        setNewFeature("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFeature.trim()) {
                        setFeatures((prev) => [...prev, newFeature.trim()]);
                        setNewFeature("");
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-[#555555] transition-colors hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {saveBar}
          </div>
        )}

        {/* Installer tab */}
        {tab === "installer" && (
          <div className="p-6">
            <div className="grid max-w-3xl grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs text-[#555555]">Install Script</label>
                <textarea
                  className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                  rows={16}
                  value={scriptInstall}
                  onChange={(e) => setScriptInstall(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Entry Point</label>
                  <input
                    className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    value={scriptEntry}
                    onChange={(e) => setScriptEntry(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Extension</label>
                  <input
                    className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    value={scriptExtension}
                    onChange={(e) => setScriptExtension(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Install Container</label>
                  <input
                    className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    value={scriptContainer}
                    onChange={(e) => setScriptContainer(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-6">{saveBar}</div>
          </div>
        )}

        {/* Variables tab */}
        {tab === "variables" && (
          <div>
            <div className="flex items-center justify-between border-b border-[#222222] bg-[#0d0d0d] px-4 py-2">
              <span className="text-xs uppercase tracking-widest text-[#555555]">Variables</span>
              <span className="text-xs text-[#444444]">{egg.variables.length}</span>
            </div>

            {egg.variables.map((v) => (
              <VariableRow
                key={v.id}
                variable={v as EggVariable}
                eggId={eggId}
                onSaved={() => invalidateEgg(eggId)}
                onDeleted={() => invalidateEgg(eggId)}
              />
            ))}

            {egg.variables.length === 0 && (
              <div className="px-4 py-6 text-sm text-[#444444]">No variables yet.</div>
            )}

            {/* Add variable */}
            <div className="border-t border-[#222222] bg-[#0d0d0d] px-4 py-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-[#444444]">Add Variable</p>
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Name</label>
                  <input
                    className="w-40 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    placeholder="Server Port"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Env Variable</label>
                  <input
                    className="w-48 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                    value={newVarEnv}
                    onChange={(e) => setNewVarEnv(e.target.value)}
                    placeholder="SERVER_PORT"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-[#555555]">Default</label>
                  <input
                    className="w-36 border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-[#555555]"
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    placeholder="25565"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  disabled={addVariableMutation.isPending || !newVarName || !newVarEnv}
                  className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
                {addVariableMutation.isError && (
                  <span className="text-xs text-[#f43f5e]">{addVariableMutation.error.message}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
