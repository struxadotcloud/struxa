import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";

export async function getBackupWithServer(uuid: string, nodeId: string) {
  const backup = await db.query.backups.findFirst({
    where: eq(backups.uuid, uuid),
    with: { server: true },
  });
  if (!backup || !backup.server || backup.server.nodeId !== nodeId) return null;
  return backup;
}
