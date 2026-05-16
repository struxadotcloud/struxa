"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  Plus,
  Upload,
  X,
} from "lucide-react";
import type { Monaco } from "@monaco-editor/react";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";

interface WingsFile {
  name: string;
  size: number;
  file: boolean;
  directory: boolean;
  symlink: boolean;
  mime?: string;
  editable?: boolean;
}

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
    json: "json", yml: "yaml", yaml: "yaml",
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    java: "java", sh: "shell", bash: "shell",
    xml: "xml", html: "html", css: "css", md: "markdown",
    sql: "sql", properties: "ini", cfg: "ini", ini: "ini",
    toml: "ini", log: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isText(file: WingsFile): boolean {
  const mime = file.mime ?? "";
  if (mime.startsWith("text/") || mime === "application/json") return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["txt", "json", "yml", "yaml", "xml", "sh", "bash", "cfg", "ini", "toml", "properties", "md", "log", "conf", "java", "js", "ts", "css", "html"].includes(ext);
}

function isImage(file: WingsFile): boolean {
  return (file.mime ?? "").startsWith("image/");
}

function FileIcon({ file, className = "h-4 w-4 shrink-0" }: { file: WingsFile; className?: string }) {
  if (file.directory) return <Folder className={`${className} text-[#f59e0b]`} />;
  if (isImage(file)) return <FileImage className={`${className} text-[#a855f7]`} />;
  if (isText(file)) return <FileCode2 className={`${className} text-[#3b82f6]`} />;
  return <File className={`${className} text-[#555555]`} />;
}

export default function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const [dirPath, setDirPath] = useState("/");
  const [entries, setEntries] = useState<WingsFile[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [selectedFile, setSelectedFile] = useState<WingsFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const { data: fileToken } = useQuery(
    orpc.files.getToken.queryOptions({ input: { serverId: id } }),
  );

  const fetchDir = useCallback(async (dir: string): Promise<WingsFile[]> => {
    if (!fileToken) return [];
    setLoadingDir(true);
    try {
      const res = await fetch(
        `${fileToken.baseUrl}/files/list-directory?directory=${encodeURIComponent(dir)}`,
        { headers: { Authorization: `Bearer ${fileToken.token}` } },
      );
      if (!res.ok) return [];
      const raw = (await res.json()) as Record<string, WingsFile>;
      const data = Object.values(raw);
      const sorted = data.sort((a, b) => {
        if (a.file !== b.file) return a.file ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setDirPath(dir);
      setSelectedFile(null);
      setEditContent("");
      setUnsaved(false);
      return sorted;
    } finally {
      setLoadingDir(false);
    }
  }, [fileToken]);

  useEffect(() => {
    if (fileToken) void fetchDir("/");
  }, [fileToken, fetchDir]);

  async function openFile(file: WingsFile) {
    if (!fileToken || !file.file || !isText(file)) {
      setSelectedFile(file);
      setEditContent("");
      setUnsaved(false);
      return;
    }
    const filePath = dirPath === "/" ? `/${file.name}` : `${dirPath}/${file.name}`;
    const res = await fetch(
      `${fileToken.baseUrl}/files/contents?file=${encodeURIComponent(filePath)}`,
      { headers: { Authorization: `Bearer ${fileToken.token}` } },
    );
    const text = res.ok ? await res.text() : "";
    setSelectedFile(file);
    setEditContent(text);
    setUnsaved(false);
  }

  async function handleSave() {
    if (!fileToken || !selectedFile) return;
    const filePath = dirPath === "/" ? `/${selectedFile.name}` : `${dirPath}/${selectedFile.name}`;
    setSaving(true);
    try {
      await fetch(
        `${fileToken.baseUrl}/files/write?file=${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fileToken.token}`,
            "Content-Type": "text/plain",
          },
          body: editContent,
        },
      );
      setUnsaved(false);
    } finally {
      setSaving(false);
    }
  }

  async function createFile() {
    const name = newFileName.trim();
    if (!fileToken || !name) return;
    const filePath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
    await fetch(
      `${fileToken.baseUrl}/files/write?file=${encodeURIComponent(filePath)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fileToken.token}`,
          "Content-Type": "text/plain",
        },
        body: "",
      },
    );
    setShowNewFile(false);
    setNewFileName("");
    const refreshed = await fetchDir(dirPath);
    const entry = refreshed.find((e) => e.name === name);
    if (entry?.file) {
      await openFile(entry);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!fileToken || !files || files.length === 0) return;
    setUploading(true);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const filePath = dirPath === "/" ? `/${file.name}` : `${dirPath}/${file.name}`;
          const buffer = await file.arrayBuffer();
          await fetch(
            `${fileToken.baseUrl}/files/write?file=${encodeURIComponent(filePath)}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${fileToken.token}`,
                "Content-Type": "application/octet-stream",
              },
              body: buffer,
            },
          );
        }),
      );
      await fetchDir(dirPath);
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));

  if (isPending || !session) return <Loader />;

  const pathSegments = dirPath === "/" ? [] : dirPath.split("/").filter(Boolean);

  function navigateUp() {
    if (pathSegments.length === 0) return;
    const parent = pathSegments.length === 1 ? "/" : "/" + pathSegments.slice(0, -1).join("/");
    void fetchDir(parent);
  }

  function navigateInto(name: string) {
    const next = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
    void fetchDir(next);
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-[#222222] px-4">
        <div className="flex items-center gap-2 text-xs">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Link href="/" className="text-[#555555] transition-colors hover:text-white">
            Game Servers
          </Link>
          <span className="text-[#333333]">/</span>
          <Link href={`/servers/${id}`} className="text-[#555555] transition-colors hover:text-white">
            {server?.name ?? id}
          </Link>
          <span className="text-[#333333]">/</span>
          <span className="text-white">Files</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-60 shrink-0 flex-col border-r border-[#222222]">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222222] px-3">
            <span className="truncate font-mono text-[11px] text-[#555555]">{dirPath}</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="New file"
                onClick={() => {
                  setShowNewFile(true);
                  setTimeout(() => newFileInputRef.current?.focus(), 0);
                }}
                className="rounded p-1 text-[#555555] transition-colors hover:bg-[#1a1a1a] hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Upload files"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                className="rounded p-1 text-[#555555] transition-colors hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          {showNewFile && (
            <div className="flex items-center gap-1 border-b border-[#222222] px-2 py-1.5">
              <Plus className="h-3.5 w-3.5 shrink-0 text-[#555555]" />
              <input
                ref={newFileInputRef}
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createFile();
                  if (e.key === "Escape") { setShowNewFile(false); setNewFileName(""); }
                }}
                placeholder="filename.ext"
                className="flex-1 bg-transparent font-mono text-xs text-white placeholder-[#444444] outline-none"
              />
              <button
                type="button"
                onClick={() => { setShowNewFile(false); setNewFileName(""); }}
                className="text-[#444444] hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto py-1">
            {pathSegments.length > 0 && (
              <button
                type="button"
                onClick={navigateUp}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[#555555] transition-colors hover:bg-[#111111] hover:text-white"
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">..</span>
              </button>
            )}
            {loadingDir ? (
              <div className="px-3 py-4 text-xs text-[#555555]">Loading…</div>
            ) : (
              entries.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => {
                    if (file.directory) {
                      navigateInto(file.name);
                    } else {
                      void openFile(file);
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#111111] ${
                    selectedFile?.name === file.name ? "bg-[#111111] text-white" : "text-[#888888]"
                  }`}
                >
                  <FileIcon file={file} />
                  <span className="flex-1 truncate font-mono">{file.name}</span>
                  {file.directory && (
                    <ChevronRight className="h-3 w-3 shrink-0 text-[#333333]" />
                  )}
                  {file.file && (
                    <span className="shrink-0 text-[10px] text-[#444444]">{fmtBytes(file.size)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#222222] px-4">
                <div className="flex items-center gap-2">
                  <FileIcon file={selectedFile} />
                  <span className="font-mono text-xs text-white">{selectedFile.name}</span>
                  {unsaved && <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />}
                </div>
                {isText(selectedFile) && (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors ${
                      unsaved && !saving
                        ? "bg-[#22c55e] text-black hover:opacity-90"
                        : "bg-[#1a1a1a] text-[#555555] cursor-default"
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {isImage(selectedFile) ? (
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
                      <span className="text-xs text-[#333333]">{fmtBytes(selectedFile.size)}</span>
                    </div>
                  </div>
                ) : isText(selectedFile) ? (
                  <Editor
                    height="100%"
                    language={getLanguage(selectedFile.name)}
                    value={editContent}
                    theme="struxa-dark"
                    onChange={(v) => { setEditContent(v ?? ""); setUnsaved(true); }}
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
                    <span className="font-mono text-xs text-[#333333]">{selectedFile.mime}</span>
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
