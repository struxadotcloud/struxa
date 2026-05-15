"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  FileCode2,
  FileImage,
  Save,
  ChevronLeft,
} from "lucide-react";
import type { Monaco } from "@monaco-editor/react";
import { mockServers, mockFileTree, type FileItem } from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

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

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    java: "java",
    sh: "shell",
    bash: "shell",
    xml: "xml",
    html: "html",
    css: "css",
    md: "markdown",
    sql: "sql",
    properties: "ini",
    cfg: "ini",
    ini: "ini",
    toml: "ini",
    log: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isTextFile(item: FileItem): boolean {
  if (!item.mimeType) return false;
  return item.mimeType.startsWith("text/") || item.mimeType === "application/json";
}

function isImageFile(item: FileItem): boolean {
  return item.mimeType?.startsWith("image/") ?? false;
}

function FileIcon({
  item,
  className = "h-4 w-4 shrink-0",
}: {
  item: FileItem;
  className?: string;
}) {
  if (item.type === "directory") return <Folder className={`${className} text-[#f59e0b]`} />;
  if (isImageFile(item)) return <FileImage className={`${className} text-[#a855f7]`} />;
  if (isTextFile(item)) return <FileCode2 className={`${className} text-[#3b82f6]`} />;
  return <File className={`${className} text-[#555555]`} />;
}

export default function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const [dirPath, setDirPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [unsaved, setUnsaved] = useState(false);

  if (isPending || !session) return <Loader />;

  const server = mockServers.find((s) => s.id === id) ?? mockServers[0];

  function currentItems(): FileItem[] {
    let items = mockFileTree;
    for (const seg of dirPath) {
      const dir = items.find((i) => i.name === seg && i.type === "directory");
      items = dir?.children ?? [];
    }
    return items;
  }

  function openFile(item: FileItem) {
    setSelectedFile(item);
    setEditContent(item.content ?? "");
    setUnsaved(false);
  }

  function handleEditorChange(value: string | undefined) {
    setEditContent(value ?? "");
    setUnsaved(true);
  }

  function handleSave() {
    setUnsaved(false);
  }

  const items = currentItems();
  const currentPathStr = dirPath.length > 0 ? "/" + dirPath.join("/") : "/";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link
            href={`/servers/${id}`}
            className="text-[#555555] transition-colors hover:text-white"
          >
            {server.name}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Files</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-60 shrink-0 flex-col border-r border-[#222222]">
          <div className="flex h-10 shrink-0 items-center border-b border-[#222222] px-3">
            <span className="truncate font-mono text-[11px] text-[#555555]">{currentPathStr}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {dirPath.length > 0 && (
              <button
                type="button"
                onClick={() => setDirPath((p) => p.slice(0, -1))}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#555555] transition-colors hover:bg-[#111111] hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">..</span>
              </button>
            )}
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  if (item.type === "directory") {
                    setDirPath((p) => [...p, item.name]);
                  } else {
                    openFile(item);
                  }
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#111111] ${
                  selectedFile?.path === item.path ? "bg-[#111111] text-white" : "text-[#888888]"
                }`}
              >
                <FileIcon item={item} />
                <span className="flex-1 truncate font-mono">{item.name}</span>
                {item.type === "directory" && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-[#333333]" />
                )}
                {item.type === "file" && item.size !== undefined && (
                  <span className="shrink-0 text-[10px] text-[#444444]">{fmtBytes(item.size)}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222222] px-4">
                <div className="flex items-center gap-2">
                  <FileIcon item={selectedFile} />
                  <span className="font-mono text-xs text-white">{selectedFile.name}</span>
                  {unsaved && <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />}
                </div>
                {isTextFile(selectedFile) && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors ${
                      unsaved
                        ? "bg-[#22c55e] text-black hover:opacity-90"
                        : "bg-[#1a1a1a] text-[#555555] cursor-default"
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {isImageFile(selectedFile) ? (
                  <div
                    className="flex h-full items-center justify-center"
                    style={{
                      backgroundImage: "repeating-conic-gradient(#111111 0% 25%, #0a0a0a 0% 50%)",
                      backgroundSize: "24px 24px",
                    }}
                  >
                    <div className="flex flex-col items-center gap-3 bg-[#0a0a0a]/80 px-8 py-6">
                      <FileImage className="h-12 w-12 text-[#333333]" />
                      <span className="font-mono text-sm text-[#555555]">{selectedFile.name}</span>
                      <span className="text-xs text-[#333333]">
                        {fmtBytes(selectedFile.size ?? 0)}
                      </span>
                    </div>
                  </div>
                ) : isTextFile(selectedFile) ? (
                  <Editor
                    height="100%"
                    language={getLanguage(selectedFile.name)}
                    value={editContent}
                    theme="struxa-dark"
                    onChange={handleEditorChange}
                    beforeMount={defineTheme}
                    options={{
                      fontSize: 13,
                      fontFamily:
                        "var(--font-geist-mono), 'JetBrains Mono', 'Fira Code', monospace",
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
                    }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3">
                    <File className="h-10 w-10 text-[#333333]" />
                    <span className="text-sm text-[#555555]">Binary file — cannot be edited</span>
                    <span className="font-mono text-xs text-[#333333]">
                      {selectedFile.mimeType}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FolderOpen className="h-10 w-10 text-[#222222]" />
              <span className="text-sm text-[#444444]">Select a file to view or edit</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
