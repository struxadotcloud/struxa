"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import {
  ChevronLeft,
  Mail,
  MailPlus,
  KeyRound,
  PartyPopper,
  Server,
  RotateCcw,
  Save,
  Eye,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@struxa/ui/components/select";

type TemplateName = "verification" | "password-reset" | "welcome" | "server-install" | "change-email";

const TEMPLATES: { name: TemplateName; icon: React.ElementType }[] = [
  { name: "verification",   icon: Mail },
  { name: "password-reset", icon: KeyRound },
  { name: "welcome",        icon: PartyPopper },
  { name: "server-install", icon: Server },
  { name: "change-email",   icon: MailPlus },
];

const SAMPLE_VARS: Record<string, string> = {
  appName: "Struxa",
  userName: "John Doe",
  verificationUrl: "https://panel.example.com/verify?token=sample-token-abc123",
  verificationToken: "sample-token-abc123",
  resetUrl: "https://panel.example.com/reset?token=sample-token-xyz789",
  resetToken: "sample-token-xyz789",
  serverName: "My Minecraft Server",
};

const VAR_DESCRIPTIONS: Record<string, { example: string; description: string }> = {
  appName:          { example: "Struxa",          description: "Your panel's application name" },
  userName:         { example: "John Doe",         description: "The recipient's display name" },
  verificationUrl:  { example: "https://…/verify", description: "Full one-time link to verify the email address" },
  verificationToken: { example: "sample-token-abc123", description: "Raw verification token (use to build a custom URL)" },
  resetUrl:         { example: "https://…/reset",  description: "Full one-time link to reset the password" },
  resetToken:       { example: "sample-token-xyz789", description: "Raw reset token (use to build a custom URL)" },
  serverName:       { example: "My MC Server",     description: "Name of the server being installed" },
};

function substitutePreview(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => SAMPLE_VARS[key] ?? `{{${key}}}`);
}

function defineEditorTheme(monaco: Monaco) {
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
    ],
    colors: {
      "editor.background": "#0a0a0a",
      "editor.foreground": "#aaaaaa",
      "editorLineNumber.foreground": "#333333",
      "editorLineNumber.activeForeground": "#555555",
      "editor.selectionBackground": "#3b82f622",
      "editor.lineHighlightBackground": "#171717",
      "editorCursor.foreground": "#3b82f6",
      "editorGutter.background": "#0a0a0a",
      "editor.inactiveSelectionBackground": "#171717",
      "editorWidget.background": "#171717",
      "editorWidget.border": "#262626",
      "input.background": "#171717",
      "input.border": "#262626",
      "scrollbarSlider.background": "#262626",
      "scrollbarSlider.hoverBackground": "#333333",
    },
  });
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function VarChip({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const info = VAR_DESCRIPTIONS[name];

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popupRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:bg-muted/80 ${open ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span>{`{{${name}}}`}</span>
      </button>

      {open && createPortal(
        <div
          ref={popupRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[9999] w-52 rounded-lg border border-border bg-card shadow-lg p-3 flex flex-col gap-1.5"
        >
          <p className="font-mono text-[11px] font-semibold text-foreground">{`{{${name}}}`}</p>
          {info && (
            <>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{info.description}</p>
              <div className="mt-0.5 rounded bg-muted px-2 py-1">
                <p className="text-[10px] text-muted-foreground/70">Example</p>
                <p className="font-mono text-[11px] text-foreground truncate">{info.example}</p>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

export default function EmailEditorPage() {
  const t = useTranslations("admin.emailEditor");

  const [active, setActive] = useState<TemplateName>("verification");

  // draft: what's currently in the editor (per template)
  const [drafts, setDrafts] = useState<Partial<Record<TemplateName, string>>>({});
  // savedHtml: what's persisted in DB for each template (used to detect unsaved changes)
  const [savedHtml, setSavedHtml] = useState<Partial<Record<TemplateName, string>>>({});

  // preview panel resize
  const [previewWidth, setPreviewWidth] = useState(420);
  const dragRef = useRef({ active: false, startX: 0, startWidth: 0 });

  const { data, isLoading } = useQuery(
    orpc.email.getTemplate.queryOptions({ input: { name: active } }),
  );
  const saveMutation = useMutation(orpc.email.saveTemplate.mutationOptions());

  // Seed draft and savedHtml when data loads for a template
  useEffect(() => {
    if (!data) return;
    const dbValue = data.customHtml ?? data.defaultHtml;
    setDrafts((d) => (d[active] !== undefined ? d : { ...d, [active]: dbValue }));
    setSavedHtml((s) => (s[active] !== undefined ? s : { ...s, [active]: dbValue }));
  }, [data, active]);

  const currentDraft = drafts[active] ?? data?.customHtml ?? data?.defaultHtml ?? "";
  const isUnsaved = currentDraft !== (savedHtml[active] ?? data?.customHtml ?? data?.defaultHtml ?? "");

  const debouncedPreview = useDebounce(currentDraft, 150);
  const previewSrc = substitutePreview(debouncedPreview);

  const handleChange = useCallback(
    (v: string | undefined) => setDrafts((d) => ({ ...d, [active]: v ?? "" })),
    [active],
  );

  async function handleSave() {
    await saveMutation.mutateAsync({ name: active, html: currentDraft });
    setSavedHtml((s) => ({ ...s, [active]: currentDraft }));
    toast.success(t("saved"));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentDraft, active]);

  function handleReset() {
    const def = data?.defaultHtml ?? "";
    setDrafts((d) => ({ ...d, [active]: def }));
  }

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startWidth: previewWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(e: MouseEvent) {
      if (!dragRef.current.active) return;
      const delta = dragRef.current.startX - e.clientX;
      setPreviewWidth(Math.max(240, Math.min(900, dragRef.current.startWidth + delta)));
    }
    function onUp() {
      dragRef.current.active = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");

  const templateLabel: Record<TemplateName, string> = {
    verification:   t("templateVerification"),
    "password-reset": t("templatePasswordReset"),
    welcome:        t("templateWelcome"),
    "server-install": t("templateServerInstall"),
    "change-email": t("templateChangeEmail"),
  };

  const activeTemplate = TEMPLATES.find((t) => t.name === active)!;
  const ActiveIcon = activeTemplate.icon;

  const editorNode = isLoading ? (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-muted-foreground">{t("loading")}</p>
    </div>
  ) : (
    <Editor
      height="100%"
      language="html"
      value={currentDraft}
      theme="struxa-dark"
      onChange={handleChange}
      beforeMount={defineEditorTheme}
      options={{
        fontSize: 13,
        fontFamily: "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace",
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        lineNumbersMinChars: 3,
        folding: false,
        contextmenu: false,
        wordWrap: "off",
      }}
    />
  );

  const previewNode = (
    <iframe
      key={active}
      srcDoc={previewSrc}
      sandbox="allow-same-origin"
      className="flex-1 w-full border-0 bg-white"
      title="Email preview"
    />
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card px-3 gap-2">
        {/* Left: back + breadcrumb / mobile template select */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/admin/settings"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">{t("backToSettings")}</span>
          </Link>

          {/* Desktop breadcrumb */}
          <span className="hidden md:inline text-muted-foreground/40 text-xs shrink-0">/</span>
          <span className="hidden md:inline text-xs font-medium text-foreground truncate">{templateLabel[active]}</span>
          {isUnsaved && <span className="hidden md:inline h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}

          {/* Mobile/tablet template selector */}
          <div className="flex md:hidden">
            <Select<TemplateName> value={active} onValueChange={(v) => { if (v) setActive(v); }}>
              <SelectTrigger className="w-44">
                <SelectValue>
                  <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{templateLabel[active]}</span>
                  {isUnsaved && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(({ name, icon: Icon }) => {
                  const hasUnsaved = drafts[name] !== undefined && savedHtml[name] !== undefined && drafts[name] !== savedHtml[name];
                  return (
                    <SelectItem key={name} value={name}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>{templateLabel[name]}</span>
                        {(hasUnsaved || (name === active && isUnsaved)) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: mobile view toggle + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile editor/preview toggle */}
          <div className="flex lg:hidden items-center rounded-lg border border-border bg-background p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setMobileView("editor")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${mobileView === "editor" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Code2 className="h-3 w-3" />
              <span className="hidden sm:inline">{t("viewEditor")}</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileView("preview")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${mobileView === "preview" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">{t("viewPreview")}</span>
            </button>
          </div>

          {isUnsaved && (
            <button
              type="button"
              onClick={handleReset}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">{t("resetDefault")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveMutation.isPending}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
              isUnsaved
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-muted text-muted-foreground cursor-default"
            }`}
          >
            <Save className="h-3 w-3" /> <span className="hidden sm:inline">{saveMutation.isPending ? t("saving") : t("save")}</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on mobile/tablet, visible md+ */}
        <div className="hidden md:flex w-48 shrink-0 flex-col border-r border-border bg-card overflow-y-auto py-2">
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {t("templates")}
          </p>
          {TEMPLATES.map(({ name, icon: Icon }) => {
            const draft = drafts[name];
            const saved = savedHtml[name];
            const hasUnsaved = draft !== undefined && saved !== undefined && draft !== saved;
            const isActive = name === active;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActive(name)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{templateLabel[name]}</span>
                {(hasUnsaved || (isActive && isUnsaved)) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
              </button>
            );
          })}

          {data?.variables && data.variables.length > 0 && (
            <div className="mt-4 px-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t("variables")}
              </p>
              <div className="flex flex-col gap-1.5">
                {data.variables.map((v) => (
                  <VarChip key={v} name={v} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile: single pane toggled by mobileView */}
        <div className="flex lg:hidden flex-1 flex-col overflow-hidden min-w-0">
          {mobileView === "editor" ? editorNode : previewNode}
        </div>

        {/* Desktop: editor + drag handle + preview */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            {editorNode}
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-foreground/30 transition-colors active:bg-foreground/50"
          />

          {/* Live preview */}
          <div className="shrink-0 flex flex-col border-l border-border" style={{ width: previewWidth }}>
            <div className="flex h-10 shrink-0 items-center border-b border-border bg-card px-3">
              <span className="text-xs text-muted-foreground">{t("preview")}</span>
            </div>
            {previewNode}
          </div>
        </div>
      </div>
    </div>
  );
}
