"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
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
  Pencil,
  Trash2,
  MoreHorizontal,
  Archive,
  PackageOpen,
  Download,
  Loader2,
} from "lucide-react";
import type { Monaco } from "@monaco-editor/react";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import Loader from "@/components/loader";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@struxa/ui/components/dropdown-menu";
import { Checkbox } from "@struxa/ui/components/checkbox";
import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@struxa/ui/components/select";
import {
  Dialog,
  DialogClose,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@struxa/ui/components/dialog";

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

function isArchiveFile(name: string): boolean {
  return /\.(tar\.gz|tgz|zip|tar\.xz|tar\.bz2|tar\.zst|tar\.lz4?|7z|tar)$/i.test(name);
}

function stripArchiveExt(name: string): string {
  return name.replace(/\.(tar\.gz|tgz|zip|tar\.xz|tar\.bz2|tar\.zst|tar\.lz4?|7z|tar)$/i, "");
}

const ARCHIVE_FORMATS = [
  { value: "tar_gz", ext: ".tar.gz" },
  { value: "zip", ext: ".zip" },
  { value: "tar_xz", ext: ".tar.xz" },
  { value: "tar_bz2", ext: ".tar.bz2" },
  { value: "tar_zstd", ext: ".tar.zst" },
  { value: "seven_zip", ext: ".7z" },
  { value: "tar", ext: ".tar" },
] as const;

const ARCHIVE_FORMAT_ITEMS = ARCHIVE_FORMATS.map((f) => ({ value: f.value, label: f.ext }));

function FileIcon({ file, className = "h-4 w-4 shrink-0" }: { file: WingsFile; className?: string }) {
  if (file.directory) return <Folder className={`${className} text-muted-foreground`} />;
  if (isImage(file)) return <FileImage className={`${className} text-purple-500`} />;
  if (isText(file)) return <FileCode2 className={`${className} text-blue-500`} />;
  return <File className={`${className} text-muted-foreground/60`} />;
}

export default function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.files");
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
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<"archive" | "unarchive" | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{ paths: string[]; name: string; format: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ label: string; paths: string[]; bulk: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const handleSaveRef = useRef<() => Promise<void>>(async () => { /* not yet ready */ });

  const filesBase = `/api/servers/${id}/files`;

  const fetchDir = useCallback(async (dir: string): Promise<WingsFile[]> => {
    setLoadingDir(true);
    try {
      const res = await fetch(
        `${filesBase}/list-directory?directory=${encodeURIComponent(dir)}`,
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
      setSelected(new Set());
      return sorted;
    } finally {
      setLoadingDir(false);
    }
  }, [filesBase]);

  useEffect(() => {
    void fetchDir("/");
  }, [fetchDir]);

  async function openFile(file: WingsFile) {
    const filePath = dirPath === "/" ? `/${file.name}` : `${dirPath}/${file.name}`;
    if (!file.file || !isText(file)) {
      setSelectedFile(file);
      setOpenFilePath(filePath);
      setEditContent("");
      setUnsaved(false);
      return;
    }
    const res = await fetch(
      `${filesBase}/contents?file=${encodeURIComponent(filePath)}`,
    );
    const text = res.ok ? await res.text() : "";
    setSelectedFile(file);
    setOpenFilePath(filePath);
    setEditContent(text);
    setUnsaved(false);
  }

  async function handleSave() {
    if (!selectedFile || !openFilePath) return;
    const filePath = openFilePath;
    setSaving(true);
    try {
      await fetch(
        `${filesBase}/write?file=${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: editContent,
        },
      );
      setUnsaved(false);
    } finally {
      setSaving(false);
    }
  }
  handleSaveRef.current = handleSave;

  async function createFile() {
    const name = newFileName.trim();
    if (!name) return;
    const filePath = dirPath === "/" ? `/${name}` : `${dirPath}/${name}`;
    await fetch(
      `${filesBase}/write?file=${encodeURIComponent(filePath)}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
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
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await Promise.all(
        Array.from(files).map(async (file) => {
          const filePath = dirPath === "/" ? `/${file.name}` : `${dirPath}/${file.name}`;
          const buffer = await file.arrayBuffer();
          await fetch(
            `${filesBase}/write?file=${encodeURIComponent(filePath)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
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

  async function handleRename(oldPath: string) {
    const newName = renameValue.trim();
    const oldName = oldPath.split("/").pop() ?? "";
    setRenamingPath(null);
    if (!newName || newName === oldName || newName.includes("/")) return;
    const parent = oldPath.split("/").slice(0, -1).join("/") || "/";
    const newPath = parent === "/" ? `/${newName}` : `${parent}/${newName}`;
    const res = await fetch(
      `${filesBase}/rename`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "", files: [{ from: oldPath, to: newPath }] }),
      },
    );
    if (!res.ok) return;
    if (openFilePath === oldPath) {
      setOpenFilePath(newPath);
      setSelectedFile((f) => (f ? { ...f, name: newName } : f));
    }
    await fetchDir(dirPath);
  }

  async function handleDelete(target: { label: string; paths: string[] }) {
    setDeleting(true);
    try {
      const res = await fetch(
        `${filesBase}/delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: "", files: target.paths }),
        },
      );
      if (!res.ok) return;
      if (openFilePath && target.paths.includes(openFilePath)) {
        setSelectedFile(null);
        setOpenFilePath(null);
        setEditContent("");
        setUnsaved(false);
      }
      setSelected(new Set());
      await fetchDir(dirPath);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function toggleSelect(itemPath: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemPath)) {
        next.delete(itemPath);
      } else {
        next.add(itemPath);
      }
      return next;
    });
  }

  function openArchiveDialog(paths: string[]) {
    const single = paths.length === 1 ? paths[0].split("/").pop() ?? "" : null;
    setArchiveDialog({
      paths,
      name: single ? `${single}.tar.gz` : "",
      format: "tar_gz",
    });
  }

  function setArchiveFormat(format: string) {
    setArchiveDialog((d) => {
      if (!d) return d;
      const newExt = ARCHIVE_FORMATS.find((f) => f.value === format)?.ext ?? ".tar.gz";
      const oldExt = ARCHIVE_FORMATS.find((f) => f.value === d.format)?.ext;
      const name = d.name && oldExt && d.name.endsWith(oldExt)
        ? `${d.name.slice(0, -oldExt.length)}${newExt}`
        : d.name;
      return { ...d, format, name };
    });
  }

  async function handleArchive(paths: string[], name?: string, format = "tar_gz") {
    setBusyAction("archive");
    try {
      const res = await fetch(
        `${filesBase}/compress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            root: dirPath,
            files: paths.map((p) => p.split("/").pop() ?? p),
            format,
            ...(name?.trim() ? { name: name.trim() } : {}),
          }),
        },
      );
      if (!res.ok) return;
      setArchiveDialog(null);
      setSelected(new Set());
      await fetchDir(dirPath);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUnarchive(path: string) {
    const base = path.split("/").pop() ?? "";
    const folder = stripArchiveExt(base);
    const parent = path.split("/").slice(0, -1).join("/") || "/";
    const folderPath = parent === "/" ? `/${folder}` : `${parent}/${folder}`;
    setBusyAction("unarchive");
    try {
      const mk = await fetch(
        `${filesBase}/create-directory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: parent, name: folder }),
        },
      );
      if (!mk.ok) return;
      const un = await fetch(
        `${filesBase}/decompress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: folderPath, file: path }),
        },
      );
      if (!un.ok) {
        await fetch(
          `${filesBase}/delete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ root: "", files: [folderPath] }),
          },
        );
        return;
      }
      await fetchDir(dirPath);
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSaveRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
      <div
        className={`relative flex flex-1 flex-col gap-3 overflow-auto px-4 py-4 md:flex-row md:overflow-hidden${isDragging ? " outline outline-2 outline-dashed outline-blue-500/40 rounded-xl" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); void handleUpload(e.dataTransfer.files); }}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-blue-500">
              <Upload className="h-10 w-10" />
              <span className="text-sm font-medium">{t("dropToUpload")}</span>
            </div>
          </div>
        )}
        <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card max-h-64 md:max-h-none md:w-60">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <span className="truncate font-mono text-[11px] text-muted-foreground">{dirPath}</span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title={t("newFile")}
                onClick={() => {
                  setShowNewFile(true);
                  setTimeout(() => newFileInputRef.current?.focus(), 0);
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={t("uploadFiles")}
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
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
            <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
                className="flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => { setShowNewFile(false); setNewFileName(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {selected.size > 0 && (
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1.5">
              <span className="text-[11px] font-medium text-foreground">{t("selectedCount", { count: selected.size })}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  title={t("archive")}
                  disabled={busyAction !== null}
                  onClick={() => openArchiveDialog(Array.from(selected))}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40"
                >
                  {busyAction === "archive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  title={t("delete")}
                  disabled={deleting}
                  onClick={() => setDeleteTarget({ label: "", paths: Array.from(selected), bulk: true })}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={t("clearSelection")}
                  onClick={() => setSelected(new Set())}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto py-1">
            {pathSegments.length > 0 && (
              <button
                type="button"
                onClick={navigateUp}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">..</span>
              </button>
            )}
            {loadingDir ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">{t("loading")}</div>
            ) : (
              entries.map((file) => {
                const itemPath = dirPath === "/" ? `/${file.name}` : `${dirPath}/${file.name}`;
                if (renamingPath === itemPath) {
                  return (
                    <div key={file.name} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <FileIcon file={file} />
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(itemPath);
                          if (e.key === "Escape") setRenamingPath(null);
                        }}
                        onBlur={() => setRenamingPath(null)}
                        className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={file.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (file.directory) {
                        navigateInto(file.name);
                      } else {
                        void openFile(file);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (file.directory) {
                          navigateInto(file.name);
                        } else {
                          void openFile(file);
                        }
                      }
                    }}
                    className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
                      openFilePath === itemPath ? "bg-muted text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Checkbox
                      className={`size-3.5 shrink-0 rounded-sm [&>svg]:size-3 ${selected.has(itemPath) ? "" : "opacity-0 group-hover:opacity-100"}`}
                      checked={selected.has(itemPath)}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleSelect(itemPath)}
                    />
                    <FileIcon file={file} />
                    <span className="flex-1 truncate font-mono">{file.name}</span>
                    {file.directory && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    )}
                    {file.file && (
                      <span className="shrink-0 text-[10px] text-muted-foreground/60">{fmtBytes(file.size)}</span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        title={t("actions")}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" style={{ minWidth: "9rem" }}>
                        {file.file && (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = `${filesBase}/download?file=${encodeURIComponent(itemPath)}`;
                              a.click();
                            }}
                          >
                            <Download />
                            {t("download")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            setRenamingPath(itemPath);
                            setRenameValue(file.name);
                          }}
                        >
                          <Pencil />
                          {t("rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          disabled={busyAction !== null}
                          onClick={() => openArchiveDialog([itemPath])}
                        >
                          {busyAction === "archive" ? <Loader2 className="animate-spin" /> : <Archive />}
                          {t("archive")}
                        </DropdownMenuItem>
                        {isArchiveFile(file.name) && (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={busyAction !== null}
                            onClick={() => void handleUnarchive(itemPath)}
                          >
                            {busyAction === "unarchive" ? <Loader2 className="animate-spin" /> : <PackageOpen />}
                            {t("unarchive")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer"
                          onClick={() => setDeleteTarget({ label: file.name, paths: [itemPath], bulk: false })}
                        >
                          <Trash2 />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {selectedFile ? (
            <>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2">
                  <FileIcon file={selectedFile} />
                  <span className="font-mono text-xs text-foreground">{selectedFile.name}</span>
                  {unsaved && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                </div>
                {isText(selectedFile) && (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                      unsaved && !saving
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-muted text-muted-foreground cursor-default"
                    }`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? t("saving") : t("save")}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                {isImage(selectedFile) ? (
                  <div className="flex h-full items-center justify-center bg-muted/30">
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-8 py-6">
                      <FileImage className="h-12 w-12 text-muted-foreground/30" />
                      <span className="font-mono text-sm text-foreground">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">{fmtBytes(selectedFile.size)}</span>
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
                    <File className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">{t("binaryFile")}</p>
                    <span className="text-xs text-muted-foreground">{t("binaryFileNote")}</span>
                    <span className="font-mono text-xs text-muted-foreground/60">{selectedFile.mime}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FolderOpen className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm font-medium text-foreground">{t("noFileSelected")}</p>
              <span className="text-xs text-muted-foreground">{t("noFileSelectedHint")}</span>
            </div>
          )}
        </div>
      </div>
      <Dialog open={archiveDialog !== null} onOpenChange={(open) => { if (!open) setArchiveDialog(null); }}>
        <DialogPopup showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("archive")}</DialogTitle>
            <DialogDescription>{t("archiveDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">{t("archiveName")}</Label>
              <Input
                autoFocus
                className="font-mono text-xs"
                placeholder={t("archiveNamePlaceholder")}
                value={archiveDialog?.name ?? ""}
                onChange={(e) => setArchiveDialog((d) => (d ? { ...d, name: e.target.value } : d))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">{t("archiveFormat")}</Label>
              <Select
                value={archiveDialog?.format}
                items={ARCHIVE_FORMAT_ITEMS}
                onValueChange={(v) => { if (v) setArchiveFormat(String(v)); }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARCHIVE_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.ext}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {t("cancel")}
            </DialogClose>
            <Button
              size="sm"
              disabled={busyAction === "archive"}
              onClick={() => { if (archiveDialog) void handleArchive(archiveDialog.paths, archiveDialog.name, archiveDialog.format); }}
            >
              {busyAction === "archive" && <Loader2 className="animate-spin" />}
              {t("createArchive")}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t("deleteFileTitle")}
        description={
          deleteTarget
            ? deleteTarget.bulk
              ? t("deleteSelectedDescription", { count: deleteTarget.paths.length })
              : t("deleteFileDescription", { name: deleteTarget.label })
            : undefined
        }
        confirmLabel={t("delete")}
        destructive
        loading={deleting}
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
      />
    </>
  );
}
