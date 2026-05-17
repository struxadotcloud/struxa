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
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#555555]">Name</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#555555]">Env Variable</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-white outline-none focus:border-[#555555]"
                value={envVariable}
                onChange={(e) => setEnvVariable(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#555555]">Default Value</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#555555]">Description</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#888888]">
              <input
                type="checkbox"
                checked={userViewable}
                onChange={(e) => setUserViewable(e.target.checked)}
                className="h-3 w-3"
              />
              User Viewable
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#888888]">
              <input
                type="checkbox"
                checked={userEditable}
                onChange={(e) => setUserEditable(e.target.checked)}
                className="h-3 w-3"
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
                className="bg-white px-3 py-1 text-xs font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startup, setStartup] = useState("");
  const [stopCommand, setStopCommand] = useState("");
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
    }
  }, [egg]);

  async function handleSave() {
    await updateMutation.mutateAsync({
      id: eggId,
      name,
      description,
      startup,
      stopCommand,
      dockerImages: serializeDockerImages(dockerImages),
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

      <div className="flex-1 overflow-auto">
        {/* Egg details */}
        <div className="border-b border-[#222222] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">Egg Details</p>
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
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Startup Command</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={startup}
                onChange={(e) => setStartup(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Stop Command</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={stopCommand}
                onChange={(e) => setStopCommand(e.target.value)}
              />
            </div>
          </div>

          {/* Docker Images */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] text-[#555555]">Docker Images</label>
              <button
                type="button"
                onClick={() => setDockerImages((prev) => [...prev, { tag: "", alias: "" }])}
                className="flex items-center gap-1 text-[10px] text-[#555555] transition-colors hover:text-white"
              >
                <Plus className="h-3 w-3" />
                Add Image
              </button>
            </div>
            {dockerImages.map((img, i) => (
              <div key={i} className="mb-1.5 flex gap-2">
                <input
                  className="flex-1 border border-[#333333] bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-white outline-none focus:border-[#555555]"
                  placeholder="ghcr.io/example/image:latest"
                  value={img.tag}
                  onChange={(e) => {
                    const updated = [...dockerImages];
                    updated[i] = { ...img, tag: e.target.value };
                    setDockerImages(updated);
                  }}
                />
                <input
                  className="w-48 border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
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

          {/* Script config */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-[#555555]">Install Script</label>
              <textarea
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-xs text-white outline-none focus:border-[#555555]"
                rows={4}
                value={scriptInstall}
                onChange={(e) => setScriptInstall(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Entry Point</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={scriptEntry}
                onChange={(e) => setScriptEntry(e.target.value)}
              />
              <label className="mb-1 mt-2 block text-[11px] text-[#555555]">Extension</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={scriptExtension}
                onChange={(e) => setScriptExtension(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#555555]">Install Container</label>
              <input
                className="w-full border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 font-mono text-sm text-white outline-none focus:border-[#555555]"
                value={scriptContainer}
                onChange={(e) => setScriptContainer(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {updateMutation.isPending ? "Saving..." : "Save Egg"}
            </button>
            {updateMutation.isSuccess && <span className="text-xs text-[#22c55e]">Saved</span>}
            {updateMutation.isError && (
              <span className="text-xs text-[#f43f5e]">{updateMutation.error.message}</span>
            )}
          </div>
        </div>

        {/* Variables */}
        <div className="border-l border-[#222222]">
          <div className="flex items-center justify-between border-r border-b border-[#222222] bg-[#0d0d0d] px-4 py-2">
            <span className="text-[10px] uppercase tracking-widest text-[#555555]">Variables</span>
            <span className="text-[10px] text-[#444444]">{egg.variables.length}</span>
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

          {/* Add variable */}
          <div className="border-r border-b border-[#222222] bg-[#0d0d0d] px-4 py-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[#444444]">Add Variable</p>
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-[#555555]">Name</label>
                <input
                  className="w-36 border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  placeholder="Server Port"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[#555555]">Env Variable</label>
                <input
                  className="w-44 border border-[#333333] bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-white outline-none focus:border-[#555555]"
                  value={newVarEnv}
                  onChange={(e) => setNewVarEnv(e.target.value)}
                  placeholder="SERVER_PORT"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-[#555555]">Default</label>
                <input
                  className="w-32 border border-[#333333] bg-[#0a0a0a] px-2 py-1 text-xs text-white outline-none focus:border-[#555555]"
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
                className="flex items-center gap-1.5 bg-white px-3 py-1 text-xs font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
              {addVariableMutation.isError && (
                <span className="text-xs text-[#f43f5e]">{addVariableMutation.error.message}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
