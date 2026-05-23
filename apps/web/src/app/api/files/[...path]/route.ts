import type { NextRequest } from "next/server";
import { auth } from "@struxa/auth";
import { getObject, headObject } from "@struxa/api/services/storage";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Cache avatars for 2 minutes; browser may serve stale for up to 10 while revalidating
const CACHE_CONTROL = "private, max-age=120, stale-while-revalidate=600";

type Params = { params: Promise<{ path: string[] }> };

function normalizeETag(etag: string) {
  return etag.replace(/^W\//, "").replace(/"/g, "");
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { path } = await params;
  const key = path.join("/");

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
          headers: { "Cache-Control": CACHE_CONTROL, "ETag": etag },
        });
      }
    } catch {
      // Object not found — fall through to the GET below for a proper 404
    }
  }

  let stream: ReadableStream;
  let etag: string | undefined;
  try {
    ({ stream, etag } = await getObject(key));
  } catch (err: unknown) {
    const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name;
    if (code === "NoSuchKey" || code === "NotFound") {
      return new Response("Not Found", { status: 404 });
    }
    throw err;
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": CACHE_CONTROL,
  };
  if (etag) headers["ETag"] = etag;

  return new Response(stream, { status: 200, headers });
}
