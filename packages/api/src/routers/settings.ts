import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { settings } from "@struxa/db";
import { env } from "@struxa/env/server";
import { recordActivity } from "../services/activity";
import { deleteObject } from "../services/storage";
import { encrypt } from "../lib/crypto";
import { adminProcedure, publicProcedure } from "../index";

const ENCRYPTED_SETTINGS_KEYS = new Set(["github_client_secret", "discord_client_secret"]);

export const settingsRouter = {
  getActiveSocialProviders: publicProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    const providers: string[] = [];
    if (s.github_enabled === "true" && s.github_client_id && s.github_client_secret) providers.push("github");
    if (s.discord_enabled === "true" && s.discord_client_id && s.discord_client_secret) providers.push("discord");
    return providers;
  }),

  isSetupComplete: publicProcedure.handler(async () => {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "setup_complete"),
    });
    return row?.value === "true";
  }),

  get: adminProcedure
    .input(z.object({ key: z.string().max(255) }))
    .handler(async ({ input }) => {
      const row = await db.query.settings.findFirst({
        where: eq(settings.key, input.key),
      });
      return row?.value ?? null;
    }),

  set: adminProcedure
    .input(z.object({ key: z.string().max(255), value: z.string() }))
    .handler(async ({ context, input }) => {
      const storageValue = ENCRYPTED_SETTINGS_KEYS.has(input.key) ? encrypt(input.value) : input.value;
      await db
        .insert(settings)
        .values({ key: input.key, value: storageValue, updatedAt: new Date() })
        .onDuplicateKeyUpdate({ set: { value: storageValue, updatedAt: new Date() } });
      context.revalidate?.();
      recordActivity({ eventType: "admin:settings.update", userId: context.session.user.id, ip: context.ip, properties: { key: input.key } });
    }),

  getAll: adminProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  }),

  getConfig: adminProcedure.handler(async () => {
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
      githubEnabled: s.github_enabled === "true",
      githubClientId: s.github_client_id ?? "",
      githubClientSecretSet: !!(s.github_client_secret),
      discordEnabled: s.discord_enabled === "true",
      discordClientId: s.discord_client_id ?? "",
      discordClientSecretSet: !!(s.discord_client_secret),
      ogTitle: s.og_title ?? "",
      ogDescription: s.og_description ?? "",
      ogSiteName: s.og_site_name ?? "",
      ogType: s.og_type ?? "website",
      twitterCard: s.twitter_card ?? "summary_large_image",
      twitterSite: s.twitter_site ?? "",
      twitterCreator: s.twitter_creator ?? "",
      themeColor: s.theme_color ?? "",
      metaKeywords: s.meta_keywords ?? "",
    };
  }),

  removeLogo: adminProcedure.handler(async ({ context }) => {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "logo_url") });
    if (row?.value) {
      const key = row.value.replace(/^\/api\/files\//, "");
      void deleteObject(key);
    }
    await db.delete(settings).where(eq(settings.key, "logo_url"));
    context.revalidate?.();
  }),

  removeOgBanner: adminProcedure.handler(async ({ context }) => {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "og_banner_url") });
    if (row?.value) {
      const key = row.value.replace(/^\/api\/files\//, "");
      void deleteObject(key);
    }
    await db.delete(settings).where(eq(settings.key, "og_banner_url"));
    context.revalidate?.();
  }),
};
