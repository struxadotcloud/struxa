import { unstable_cache } from "next/cache";
import { db, settings } from "@struxa/db";
import { env } from "@struxa/env/server";

export const INSTANCE_SETTINGS_TAG = "instance-settings";

const DEFAULTS = {
  appName: env.APP_NAME ?? "Struxa",
  appNameFromEnv: !!env.APP_NAME,
  appUrl: env.APP_URL ?? "",
  appUrlFromEnv: !!env.APP_URL,
  metaDescription: "",
  registrationEnabled: true,
  logoUrl: null as string | null,
  ogBannerUrl: null as string | null,
  socialProviders: [] as string[],
  raw: {} as Record<string, string>,
};

export const getInstanceSettings = unstable_cache(
  async () => {
    try {
      const rows = await db.select().from(settings);
      const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
      return {
        appName: env.APP_NAME ?? s.app_name ?? "Struxa",
        appNameFromEnv: !!env.APP_NAME,
        appUrl: env.APP_URL ?? s.app_url ?? "",
        appUrlFromEnv: !!env.APP_URL,
        metaDescription: s.meta_description ?? "",
        registrationEnabled: s.registration_enabled !== "false",
        logoUrl: s.logo_url ?? null,
        ogBannerUrl: s.og_banner_url ?? null,
        socialProviders: [
          ...(s.github_enabled === "true" && s.github_client_id && s.github_client_secret ? ["github"] : []),
          ...(s.discord_enabled === "true" && s.discord_client_id && s.discord_client_secret ? ["discord"] : []),
        ],
        raw: s,
      };
    } catch {
      return DEFAULTS;
    }
  },
  [INSTANCE_SETTINGS_TAG],
  { tags: [INSTANCE_SETTINGS_TAG] },
);
