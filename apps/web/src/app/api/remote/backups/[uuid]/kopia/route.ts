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

  const backup = await getBackupWithServer(uuid, auth.node.id);
  if (!backup || !backup.server) return new Response("Not Found", { status: 404 });

  const destination = await resolveDestinationForNode(backup.server.nodeId);
  if (!destination || destination.type !== "kopia") {
    return new Response("No kopia backup destination configured for this node", {
      status: 400,
    });
  }

  return Response.json({
    url: destination.url,
    username: destination.username,
    password: destination.password,
    fingerprint: destination.fingerprint ?? null,
    tags: destination.tags,
  });
}
