import type { NextRequest } from "next/server";
import { resolveDestinationForNode } from "@struxa/api/lib/backup-destinations";
import { authenticateWings } from "@/lib/wings-auth";
import { getBackupWithServer } from "@/lib/remote-backups";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(_req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;

  const backup = await getBackupWithServer(uuid);
  if (!backup || !backup.server) return new Response("Not Found", { status: 404 });

  const destination = await resolveDestinationForNode(backup.server.nodeId);
  if (!destination || destination.type !== "pbs") {
    return new Response("No PBS backup destination configured for this node", {
      status: 400,
    });
  }

  return Response.json({
    url: destination.url,
    datastore: destination.datastore,
    namespace: destination.namespace ?? null,
    token_id: destination.tokenId,
    token_secret: destination.tokenSecret,
    fingerprint: destination.fingerprint ?? null,
    backup_id_prefix: destination.backupIdPrefix ?? null,
    server_uuid: backup.server.uuid,
    backup_created: backup.createdAt.toISOString(),
  });
}
