import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { getAuth } from "@struxa/auth";
import { uploadObject } from "@struxa/api/services/storage";

export const maxRequestBodySize = "6mb";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "File type not allowed. Use JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File exceeds 5 MB limit." }, { status: 400 });
  }

  const key = `billing/images/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(key, buffer, file.type);

  return Response.json({ url: `/api/files/${key}` });
}
