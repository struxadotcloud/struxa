import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { backups } from "@struxa/db";

export async function getBackupWithServer(uuid: string) {
  return db.query.backups.findFirst({
    where: eq(backups.uuid, uuid),
    with: { server: true },
  });
}
