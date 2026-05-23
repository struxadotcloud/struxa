import type { NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { getObject, headObject } from "@struxa/api/services/storage";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

const CACHE_PRIVATE = "private, max-age=120, stale-while-revalidate=600";
const CACHE_PUBLIC = "public, max-age=3600, stale-while-revalidate=86400";

const PUBLIC_PREFIXES = ["logos/", "banners/"];

type Params = { params: Promise<{ path: string[] }> };

function normalizeETag(etag: string) {
  return etag.replace(/^W\//, "").replace(/"/g, "");
}

export async function GET(req: NextRequest, { params }: Params) {
  const { path } = await params;
  const key = path.join("/");

  const isPublic = PUBLIC_PREFIXES.some((p) => key.startsWith(p));
  if (!isPublic) {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return new Response("Unauthorized", { status: 401 });
  }

  const cacheControl = isPublic ? CACHE_PUBLIC : CACHE_PRIVATE;

  const lastSegment = path[path.length - 1] ?? "";
  const dotIdx = lastSegment.lastIndexOf(".");
  const ext = dotIdx >= 0 ? lastSegment.slice(dotIdx + 1).toLowerCase() : "";
  const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";

  const ifNoneMatch = req.headers.get("if-none-match");

  // Cheap ETag check — no body download needed
  if (ifNoneMatch) {
    try {
      const { etag } = await headObject(key);
      if (etag && normalizeETag(etag) === normalizeETag(ifNoneMatch)) {
        return new Response(null, {
          status: 304,
          headers: { "Cache-Control": cacheControl, "ETag": etag },
        });
      }
    } catch (err: unknown) {
      const e = err as { Code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
      const code = e.Code ?? e.name;
      const httpStatus = e.$metadata?.httpStatusCode;
      if (code !== "NoSuchKey" && code !== "NotFound" && httpStatus !== 404) {
        console.error(`[files] headObject(${key}) failed:`, err);
      }
    }
  }

  let stream: ReadableStream;
  let etag: string | undefined;
  try {
    ({ stream, etag } = await getObject(key));
  } catch (err: unknown) {
    const e = err as { Code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
    const code = e.Code ?? e.name;
    const httpStatus = e.$metadata?.httpStatusCode;
    if (code === "NoSuchKey" || code === "NotFound" || httpStatus === 404) {
      return new Response("Not Found", { status: 404 });
    }
    console.error(`[files] getObject(${key}) failed:`, err);
    throw err;
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  };
  if (etag) headers["ETag"] = etag;

  return new Response(stream, { status: 200, headers });
}
