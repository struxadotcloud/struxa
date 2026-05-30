import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { getEnabledExtension } from "@struxa/extension-host";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function notFound() {
  return new Response("Not found", { status: 404 });
}

/**
 * Serves an installed extension's static UI bundle from
 * `${EXTENSIONS_DIR}/<id>@<version>/web/`. This is the iframe source embedded by
 * <ExtensionFrame>. Only the host page may frame it (CSP/X-Frame-Options), and
 * path traversal outside the bundle dir is rejected. Unknown paths fall back to
 * index.html so client-side routed SPAs work.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; path?: string[] }> },
) {
  const { id, path: parts = [] } = await params;

  const ext = await getEnabledExtension(id);
  if (!ext) return notFound();

  const webRoot = path.normalize(path.join(ext.dir, "web"));
  const rel = parts.join("/") || "index.html";
  let filePath = path.normalize(path.join(webRoot, rel));

  // Normalised prefix check (catches simple traversal before hitting the FS).
  if (filePath !== webRoot && !filePath.startsWith(webRoot + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Only fall back to index.html for navigational requests; asset requests
  // (JS, CSS, map files) should 404 rather than returning HTML.
  const acceptsHtml = _req.headers.get("accept")?.includes("text/html") ?? false;
  const hasFileExt = path.extname(rel.split("?")[0]!) !== "";
  const canFallback = acceptsHtml || !hasFileExt;

  let data: Buffer;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    // Resolve symlinks and re-check so a symlink inside the tarball cannot
    // escape the bundle directory (symlink bypass / path traversal).
    const [realRoot, realFile] = await Promise.all([realpath(webRoot), realpath(filePath)]);
    if (realFile !== realRoot && !realFile.startsWith(realRoot + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }
    data = await readFile(realFile);
  } catch {
    if (!canFallback) return notFound();
    // SPA fallback — also realpath-checked.
    try {
      const fallback = path.join(webRoot, "index.html");
      const [realRoot, realFallback] = await Promise.all([realpath(webRoot), realpath(fallback)]);
      if (realFallback !== realRoot && !realFallback.startsWith(realRoot + path.sep)) {
        return notFound();
      }
      data = await readFile(realFallback);
      filePath = fallback;
    } catch {
      return notFound();
    }
  }

  const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": type,
      // Only our own origin may embed extension UIs.
      "content-security-policy": "frame-ancestors 'self'",
      "x-frame-options": "SAMEORIGIN",
      "cache-control": "no-cache",
    },
  });
}
