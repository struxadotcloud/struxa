import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";
import { authenticateWings } from "@/lib/wings-auth";

interface BackupCompleteBody {
  successful: boolean;
  checksum?: string;
  checksum_type?: string;
  size?: number;
  parts?: unknown[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;

  const backup = await db.query.backups.findFirst({
    where: eq(backups.uuid, uuid),
  });
  if (!backup) return new Response("Not Found", { status: 404 });

  const body = (await req.json()) as BackupCompleteBody;

  const checksum = body.checksum
    ? body.checksum_type
      ? `${body.checksum_type}:${body.checksum}`
      : body.checksum
    : null;

  await db
    .update(backups)
    .set({
      isSuccessful: body.successful ?? false,
      bytes: body.size ?? 0,
      checksum: checksum ?? undefined,
      completedAt: new Date(),
    })
    .where(eq(backups.uuid, uuid));

  return new Response(null, { status: 204 });
}
