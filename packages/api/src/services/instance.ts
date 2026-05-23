import { eq } from "drizzle-orm";
import { db, settings } from "@struxa/db";
import { env } from "@struxa/env/server";

export async function getEffectiveAppUrl(): Promise<string> {
  if (env.APP_URL) return env.APP_URL;
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "app_url") });
  return row?.value ?? "";
}
