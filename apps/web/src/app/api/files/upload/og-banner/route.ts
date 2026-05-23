import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getAuth } from "@struxa/auth";
import { db, settings } from "@struxa/db";
import { uploadObject, deleteObject } from "@struxa/api/services/storage";
import { INSTANCE_SETTINGS_TAG } from "@/lib/instance-settings";

export const maxRequestBodySize = "10mb";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 8 * 1024 * 1024;

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
    return Response.json({ error: "File type not allowed. Use JPEG, PNG, or WebP." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File exceeds 8 MB limit." }, { status: 400 });
  }

  const newKey = `banners/og-banner.${ext}`;

  const existing = await db.query.settings.findFirst({ where: eq(settings.key, "og_banner_url") });
  if (existing?.value) {
    const oldKey = existing.value.replace(/^\/api\/files\//, "");
    if (oldKey !== newKey) void deleteObject(oldKey);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(newKey, buffer, file.type);

  const proxyUrl = `/api/files/${newKey}`;
  await db
    .insert(settings)
    .values({ key: "og_banner_url", value: proxyUrl, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value: proxyUrl, updatedAt: new Date() } });

  revalidateTag(INSTANCE_SETTINGS_TAG, {});

  return Response.json({ url: proxyUrl });
}
