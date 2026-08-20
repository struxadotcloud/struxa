import type { NextRequest } from "next/server";
import {
  ensureGDriveFolders,
  getGDriveConnection,
  getOperatorGDriveConfig,
} from "@struxa/api/services/google-drive";
import { authenticateWings } from "@/lib/wings-auth";
import { getBackupWithServer } from "@/lib/remote-backups";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const auth = await authenticateWings(req);
  if (!auth.ok) return auth.response;

  const { uuid } = await params;

  const backup = await getBackupWithServer(uuid, auth.node.id);
  if (!backup) return new Response("Not Found", { status: 404 });

  if (backup.disk !== "google-drive" || !backup.driveUserId) {
    return new Response("This backup is not stored in Google Drive", { status: 400 });
  }

  const config = await getOperatorGDriveConfig();
  if (!config) return new Response("Google Drive is not configured", { status: 400 });

  const connection = await getGDriveConnection(backup.driveUserId);
  if (!connection) return new Response("Google Drive connection removed", { status: 400 });

  let folderId: string;
  try {
    folderId = await ensureGDriveFolders(connection, backup.server.name, backup.server.uuid);
  } catch {
    return new Response("Failed to resolve Google Drive folder", { status: 400 });
  }

  return Response.json({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    folder_id: folderId,
    file_id: backup.remoteFileId ?? null,
  });
}
