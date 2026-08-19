import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";
import { resolveDestinationForNode } from "@struxa/api/lib/backup-destinations";
import { abortMultipart, completeMultipart } from "@struxa/api/services/backup-s3";
import { authenticateWings } from "@/lib/wings-auth";

interface BackupCompleteBody {
  successful: boolean;
  checksum?: string;
  checksum_type?: string;
  size?: number;
  parts?: { etag?: string; part_number?: number }[];
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

  if (backup.disk === "s3") {
    const destination = await resolveDestinationForNode(auth.node.id);
    if (!destination || destination.type !== "s3") {
      return new Response("No S3 backup destination configured for this node", {
        status: 400,
      });
    }
    try {
      if (body.successful && body.parts && body.parts.length > 0) {
        await completeMultipart(
          destination,
          uuid,
          body.parts as { etag: string; part_number: number }[],
        );
      } else if (!body.successful) {
        await abortMultipart(destination, uuid);
      }
    } catch {
      return new Response("Failed to finalize S3 multipart upload", {
        status: 500,
      });
    }
  }

  return new Response(null, { status: 204 });
}
