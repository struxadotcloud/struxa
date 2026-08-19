import type { NextRequest } from "next/server";
import { resolveDestinationForNode } from "@struxa/api/lib/backup-destinations";
import { presignUploadParts } from "@struxa/api/services/backup-s3";
import { authenticateWings } from "@/lib/wings-auth";
import { getBackupWithServer } from "@/lib/remote-backups";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;

  const backup = await getBackupWithServer(uuid);
  if (!backup || !backup.server) return new Response("Not Found", { status: 404 });

  const destination = await resolveDestinationForNode(backup.server.nodeId);
  if (!destination || destination.type !== "s3") {
    return new Response("No S3 backup destination configured for this node", {
      status: 400,
    });
  }

  const fromParam = req.nextUrl.searchParams.get("from_part");
  const fromPart = fromParam ? Math.max(1, Number(fromParam)) : 1;

  const result = await presignUploadParts(destination, uuid, undefined, fromPart);
  return Response.json({ part_size: result.part_size, parts: result.parts });
}
