"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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

function inputClass(mono?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${mono ? " font-mono" : ""}`;
}

function VariableRow({
  variable,
  eggId,
  onSaved,
  onDeleted,
  isLast,
}: {
  variable: EggVariable;
  eggId: string;
  onSaved: () => void;
  onDeleted: () => void;
  isLast: boolean;
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
        <div onContextMenu={onContextMenu} className={`px-4 py-4 hover:bg-muted/40 transition-colors ${!isLast ? "border-b border-border" : ""}`}>
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Name</label>
              <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Env Variable</label>
              <input className={inputClass(true)} value={envVariable} onChange={(e) => setEnvVariable(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Default Value</label>
              <input className={inputClass()} value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Description</label>
              <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            {[
              { checked: userViewable, set: setUserViewable, label: "User Viewable" },
              { checked: userEditable, set: setUserEditable, label: "User Editable" },
            ].map(({ checked, set, label }) => (
              <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="h-3.5 w-3.5 rounded"
                />
                {label}
              </label>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved</span>}
              {updateMutation.isError && <span className="text-xs text-destructive">{updateMutation.error.message}</span>}
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
                className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
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
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!egg) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Egg not found.</div>;
  }

  const saveBar = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {updateMutation.isPending ? "Saving..." : "Save"}
      </button>
      {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">Saved</span>}
      {updateMutation.isError && <span className="text-xs text-destructive">{updateMutation.error.message}</span>}
    </div>
  );

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
            {t.id === "variables" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {egg.variables.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === "general" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Egg Details</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Name</label>
                    <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Description</label>
                    <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Startup Command</label>
                    <input className={inputClass(true)} value={startup} onChange={(e) => setStartup(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Stop Command</label>
                    <input className={inputClass(true)} value={stopCommand} onChange={(e) => setStopCommand(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-foreground">
                    Running Detection
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      — Wings marks server as running when any pattern is found in console output
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {startupDetection.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                        <span className="font-mono text-sm text-foreground">{s}</span>
                        <button
                          type="button"
                          onClick={() => setStartupDetection((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        className="w-80 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4">{saveBar}</div>
              </div>
            </div>
          </div>
        )}

        {tab === "environment" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Docker Images</h2>
              </div>
              <div className="p-4">
                {dockerImages.length === 0 && (
                  <p className="mb-3 text-sm text-muted-foreground">No Docker images configured.</p>
                )}
                <div className="flex flex-col gap-2">
                  {dockerImages.map((img, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                        placeholder="ghcr.io/example/image:latest"
                        value={img.tag}
                        onChange={(e) => {
                          const updated = [...dockerImages];
                          updated[i] = { ...img, tag: e.target.value };
                          setDockerImages(updated);
                        }}
                      />
                      <input
                        className="w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
                        className="rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDockerImages((prev) => [...prev, { tag: "", alias: "" }])}
                  className="mt-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Image
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Features
                  <span className="ml-1.5 font-normal text-xs text-muted-foreground">— Wings uses these to enable specific behaviors (e.g. eula, steam)</span>
                </h2>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                      <span className="font-mono text-sm text-foreground">{f}</span>
                      <button
                        type="button"
                        onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      className="w-44 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {saveBar}
          </div>
        )}

        {tab === "installer" && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Install Script</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Script</label>
                    <textarea
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      rows={16}
                      value={scriptInstall}
                      onChange={(e) => setScriptInstall(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Entry Point</label>
                      <input className={inputClass(true)} value={scriptEntry} onChange={(e) => setScriptEntry(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Extension</label>
                      <input className={inputClass(true)} value={scriptExtension} onChange={(e) => setScriptExtension(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">Install Container</label>
                      <input className={inputClass(true)} value={scriptContainer} onChange={(e) => setScriptContainer(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="mt-4">{saveBar}</div>
              </div>
            </div>
          </div>
        )}

        {tab === "variables" && (
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="text-xs font-medium text-muted-foreground">Variables</span>
              </div>

              {egg.variables.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No variables yet.</div>
              )}

              {egg.variables.map((v, i) => (
                <VariableRow
                  key={v.id}
                  variable={v as EggVariable}
                  eggId={eggId}
                  onSaved={() => invalidateEgg(eggId)}
                  onDeleted={() => invalidateEgg(eggId)}
                  isLast={i === egg.variables.length - 1}
                />
              ))}

              <div className="border-t border-border bg-muted/20 px-4 py-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Add Variable</p>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Name</label>
                    <input
                      className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder="Server Port"
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Env Variable</label>
                    <input
                      className="w-48 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      value={newVarEnv}
                      onChange={(e) => setNewVarEnv(e.target.value)}
                      placeholder="SERVER_PORT"
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Default</label>
                    <input
                      className="w-36 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
                    className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                  {addVariableMutation.isError && (
                    <span className="text-xs text-destructive">{addVariableMutation.error.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
