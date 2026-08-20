import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { ORPCError } from "@orpc/server";
import { getAuth } from "@struxa/auth";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";
import { requireServerAccess } from "@struxa/api/lib/server-access";
import { downloadDriveFile, getGDriveConnection } from "@struxa/api/services/google-drive";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const backup = await db.query.backups.findFirst({
    where: eq(backups.id, id),
  });
  if (!backup || !backup.isSuccessful) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    await requireServerAccess(session.user.id, backup.serverId, session.user.role);
  } catch (err) {
    if (err instanceof ORPCError) {
      return new Response("Not Found", { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    throw err;
  }

  if (backup.disk !== "google-drive") {
    return new Response("This backup is not stored in Google Drive", { status: 400 });
  }
  if (!backup.remoteFileId) {
    return new Response("Backup file no longer exists in Google Drive", { status: 400 });
  }
  if (!backup.driveUserId) {
    return new Response("Google Drive connection removed", { status: 400 });
  }
  const connection = await getGDriveConnection(backup.driveUserId);
  if (!connection) {
    return new Response("Google Drive connection removed", { status: 400 });
  }

  try {
    const driveRes = await downloadDriveFile(connection, backup.remoteFileId);
    if (!driveRes.ok) {
      return new Response("Backup file no longer exists in Google Drive", {
        status: driveRes.status === 404 ? 404 : 400,
      });
    }
    return new Response(driveRes.body, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${backup.name.replace(/["\\\r\n]/g, "_")}.tar.gz"`,
      },
    });
  } catch {
    return new Response("Failed to download backup from Google Drive", { status: 500 });
  }
}
