import { eq } from "drizzle-orm";
import { db, settings } from "@struxa/db";

export async function checkSetupComplete(): Promise<boolean> {
  try {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "setup_complete"),
    });
    return row?.value === "true";
  } catch {
    return false;
  }
}
