import { readFile, stat } from "node:fs/promises";
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

  // Path-traversal guard: resolved path must stay inside the bundle dir.
  if (filePath !== webRoot && !filePath.startsWith(webRoot + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  let data: Buffer;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
    data = await readFile(filePath);
  } catch {
    // SPA fallback.
    try {
      filePath = path.join(webRoot, "index.html");
      data = await readFile(filePath);
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
