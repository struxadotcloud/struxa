import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { auth } from "@struxa/auth";
import { db, user } from "@struxa/db";
import { uploadObject, deleteObject } from "@struxa/api/services/storage";

export const maxRequestBodySize = "6mb";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

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

  const newKey = `avatars/${session.user.id}.${ext}`;

  // Clean up old avatar if extension changed
  const existing = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: { image: true },
  });
  if (existing?.image) {
    const oldKey = existing.image.replace(/^\/api\/files\//, "");
    if (oldKey !== newKey) {
      void deleteObject(oldKey);
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(newKey, buffer, file.type);

  const proxyUrl = `/api/files/${newKey}`;
  await db.update(user).set({ image: proxyUrl }).where(eq(user.id, session.user.id));

  return Response.json({ url: proxyUrl });
}
