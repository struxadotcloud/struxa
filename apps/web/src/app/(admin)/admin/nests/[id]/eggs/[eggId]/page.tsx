"use client";

import { use, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import { orpc, queryClient } from "@/utils/orpc";
import { ContextMenu, RowMenu, type ActionItem } from "@/components/context-menu";

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("struxa-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "aaaaaa", background: "0a0a0a" },
      { token: "comment", foreground: "555555", fontStyle: "italic" },
      { token: "string", foreground: "22c55e" },
      { token: "keyword", foreground: "3b82f6" },
      { token: "number", foreground: "f59e0b" },
      { token: "type", foreground: "a855f7" },
      { token: "variable", foreground: "aaaaaa" },
    ],
    colors: {
      "editor.background": "#0a0a0a",
      "editor.foreground": "#aaaaaa",
      "editorLineNumber.foreground": "#333333",
      "editorLineNumber.activeForeground": "#555555",
      "editor.selectionBackground": "#22c55e22",
      "editor.lineHighlightBackground": "#111111",
      "editorCursor.foreground": "#22c55e",
      "editorGutter.background": "#0a0a0a",
      "editor.inactiveSelectionBackground": "#1a1a1a",
      "editorWidget.background": "#141414",
      "editorWidget.border": "#222222",
      "input.background": "#141414",
      "input.border": "#222222",
      "scrollbarSlider.background": "#222222",
      "scrollbarSlider.hoverBackground": "#333333",
      "editorBracketMatch.background": "#22c55e22",
      "editorBracketMatch.border": "#22c55e44",
    },
  });
}

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
  const t = useTranslations("admin.nests");
  const tc = useTranslations("common");

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
      label: t("deleteVariable"),
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
              <label className="text-xs font-medium text-foreground">{t("varNameLabel")}</label>
              <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("varEnvLabel")}</label>
              <input className={inputClass(true)} value={envVariable} onChange={(e) => setEnvVariable(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("varDefaultLabel")}</label>
              <input className={inputClass()} value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">{t("eggDescriptionLabel")}</label>
              <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            {[
              { checked: userViewable, set: setUserViewable, label: t("userViewable") },
              { checked: userEditable, set: setUserEditable, label: t("userEditable") },
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
              {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">{tc("saved")}</span>}
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
                {updateMutation.isPending ? tc("saving") : tc("save")}
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

export default function EggDetailPage({
  params,
}: {
  params: Promise<{ id: string; eggId: string }>;
}) {
  const t = useTranslations("admin.nests");
  const tc = useTranslations("common");

  const TABS: { id: Tab; label: string }[] = [
    { id: "general", label: t("eggTabGeneral") },
    { id: "environment", label: t("eggTabEnvironment") },
    { id: "installer", label: t("eggTabInstaller") },
    { id: "variables", label: t("eggTabVariables") },
  ];

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
  const tabRef = useRef<Tab>("general");
  const handleSaveRef = useRef<() => Promise<void>>(async () => { /* not yet ready */ });

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

  tabRef.current = tab;
  handleSaveRef.current = handleSave;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        const t = tabRef.current;
        if (t === "general" || t === "environment" || t === "installer") {
          e.preventDefault();
          void handleSaveRef.current();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleExport() {
    if (!egg) return;
    const dockerImagesRecord = (JSON.parse(egg.dockerImages ?? "{}") as Record<string, string>);
    const payload = {
      _comment: "DO NOT EDIT: FILE GENERATED AUTOMATICALLY BY STRUXA PANEL",
      meta: { version: "PTDL_v2", update_url: null },
      exported_at: new Date().toISOString(),
      name: egg.name,
      description: egg.description ?? "",
      startup: egg.startup,
      config: {
        files: egg.configFiles ?? "",
        startup: egg.configStartup ?? "",
        stop: egg.stopCommand ?? egg.configStop ?? "",
        logs: egg.configLogs ?? "",
      },
      scripts: {
        installation: {
          script: egg.scriptInstall ?? "",
          container: egg.scriptContainer ?? "",
          entrypoint: egg.scriptEntry ?? "bash",
        },
      },
      variables: egg.variables.map((v) => ({
        name: v.name,
        description: v.description ?? "",
        env_variable: v.envVariable,
        default_value: v.defaultValue ?? "",
        user_viewable: v.userViewable,
        user_editable: v.userEditable,
        rules: v.rules ?? "",
      })),
      docker_images: dockerImagesRecord,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${egg.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{tc("loading")}</div>;
  }

  if (!egg) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("eggNotFound")}</div>;
  }

  const saveBar = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={updateMutation.isPending}
        className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        {updateMutation.isPending ? tc("saving") : tc("save")}
      </button>
      {updateMutation.isSuccess && <span className="text-xs font-medium text-green-500">{tc("saved")}</span>}
      {updateMutation.isError && <span className="text-xs text-destructive">{updateMutation.error.message}</span>}
    </div>
  );

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-4">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === tabItem.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabItem.label}
            {tabItem.id === "variables" && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {egg.variables.length}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {tc("export")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }}>
        {tab === "general" && (
          <div className="mx-auto max-w-2xl flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">{t("eggDetailsTitle")}</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("eggNameLabel")}</label>
                    <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("eggDescriptionLabel")}</label>
                    <input className={inputClass()} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("eggStartupLabel")}</label>
                    <input className={inputClass(true)} value={startup} onChange={(e) => setStartup(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("eggStopCommandLabel")}</label>
                    <input className={inputClass(true)} value={stopCommand} onChange={(e) => setStopCommand(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-foreground">
                    {t("eggRunningDetectionLabel")}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      {t("eggRunningDetectionDesc")}
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
                        {tc("add")}
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
                <h2 className="text-sm font-semibold text-foreground">{t("dockerImagesTitle")}</h2>
              </div>
              <div className="p-4">
                {dockerImages.length === 0 && (
                  <p className="mb-3 text-sm text-muted-foreground">{t("noDockerImages")}</p>
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
                  {t("addImage")}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("featuresTitle")}
                  <span className="ml-1.5 font-normal text-xs text-muted-foreground">{t("featuresDesc")}</span>
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
                      {tc("add")}
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
                <h2 className="text-sm font-semibold text-foreground">{t("installScriptTitle")}</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("scriptLabel")}</label>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <Editor
                        height="320px"
                        language="shell"
                        value={scriptInstall}
                        theme="struxa-dark"
                        onChange={(v) => setScriptInstall(v ?? "")}
                        beforeMount={defineTheme}
                        options={{
                          fontSize: 13,
                          fontFamily: "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace",
                          lineHeight: 20,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          renderLineHighlight: "line",
                          overviewRulerBorder: false,
                          hideCursorInOverviewRuler: true,
                          padding: { top: 12, bottom: 12 },
                          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                          lineNumbersMinChars: 3,
                          folding: false,
                          contextmenu: false,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("entryPointLabel")}</label>
                      <input className={inputClass(true)} value={scriptEntry} onChange={(e) => setScriptEntry(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("extensionLabel")}</label>
                      <input className={inputClass(true)} value={scriptExtension} onChange={(e) => setScriptExtension(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-foreground">{t("installContainerLabel")}</label>
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
                <span className="text-xs font-medium text-muted-foreground">{t("variablesTitle")}</span>
              </div>

              {egg.variables.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("noVariables")}</div>
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
                <p className="mb-3 text-xs font-medium text-muted-foreground">{t("addVariableTitle")}</p>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("varNameLabel")}</label>
                    <input
                      className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder={t("varNamePlaceholder")}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("varEnvLabel")}</label>
                    <input
                      className="w-48 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      value={newVarEnv}
                      onChange={(e) => setNewVarEnv(e.target.value)}
                      placeholder={t("varEnvPlaceholder")}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleAddVariable(); }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">{t("varDefaultLabel")}</label>
                    <input
                      className="w-36 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
                      value={newVarDefault}
                      onChange={(e) => setNewVarDefault(e.target.value)}
                      placeholder={t("varDefaultPlaceholder")}
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
                    {tc("add")}
                  </button>
                  {addVariableMutation.isError && (
                    <span className="text-xs text-destructive">{addVariableMutation.error.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </motion.div>
      </div>
    </>
  );
}
