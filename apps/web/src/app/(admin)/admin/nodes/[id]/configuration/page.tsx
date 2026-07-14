"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import { orpc, queryClient } from "@/utils/orpc";

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
      "editorBracketMatch.background": "#3b82f622",
      "editorBracketMatch.border": "#3b82f644",
    },
  });
}

function invalidateNode(id: string) {
  void queryClient.invalidateQueries(orpc.nodes.get.queryOptions({ input: { id } }));
}

export default function NodeConfigurationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin.nodes");
  const tc = useTranslations("common");
  const { data: deployConfig } = useQuery(
    orpc.nodes.getDeploymentConfig.queryOptions({ input: { id } }),
  );

  const regenTokenMutation = useMutation(
    orpc.nodes.regenerateToken.mutationOptions({
      onSuccess: () => {
        invalidateNode(id);
        void queryClient.invalidateQueries(
          orpc.nodes.getDeploymentConfig.queryOptions({ input: { id } }),
        );
        toast.success(tc("saved"));
      },
    }),
  );
  const [copiedConfig, setCopiedConfig] = useState(false);

  async function handleCopyConfig() {
    if (deployConfig?.yaml) {
      await navigator.clipboard.writeText(deployConfig.yaml);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-500/80">
        <span className="font-semibold">{t("configNotice")}</span> {t("configNoticeBody")} <span className="font-mono">uuid</span>, <span className="font-mono">token_id</span>, and <span className="font-mono">token</span> {t("configNoticeBody2")}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">{t("configFileLabel")}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyConfig}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Copy className="h-3 w-3" />
              {copiedConfig ? tc("copied") : tc("copy")}
            </button>
            <button
              type="button"
              onClick={() => regenTokenMutation.mutate({ id })}
              disabled={regenTokenMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" />
              {t("regenToken")}
            </button>
          </div>
        </div>
        <div className="h-[680px]">
          <Editor
            height="100%"
            language="yaml"
            value={deployConfig?.yaml ?? ""}
            theme="struxa-dark"
            beforeMount={defineTheme}
            options={{
              readOnly: true,
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
              domReadOnly: true,
              cursorBlinking: "solid",
            }}
          />
        </div>
      </div>
    </div>
  );
}
