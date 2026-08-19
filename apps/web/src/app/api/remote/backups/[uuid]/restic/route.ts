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
  if (!destination || destination.type !== "restic") {
    return new Response("No restic backup destination configured for this node", {
      status: 400,
    });
  }

  const environment = { ...destination.environment };
  if (destination.password) environment.RESTIC_PASSWORD = destination.password;

  return Response.json({
    repository: destination.repository,
    password_file: null,
    retry_lock_seconds: destination.retryLockSeconds,
    environment,
  });
}
