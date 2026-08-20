import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { settings } from "@struxa/db";
import { env } from "@struxa/env/server";
import { recordActivity } from "../services/activity";
import { deleteObject } from "../services/storage";
import { encrypt } from "../lib/crypto";
import { adminProcedure, publicProcedure } from "../index";

const ENCRYPTED_SETTINGS_KEYS = new Set(["github_client_secret", "discord_client_secret", "google_drive_client_secret"]);

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
      googleDriveClientId: s.google_drive_client_id ?? "",
      googleDriveClientSecretSet: !!(s.google_drive_client_secret),
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

  getBillingConfig: adminProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return {
      enabled: s.billing_enabled !== "false",
      defaultCurrency: s.billing_default_currency || "USD",
      trialsEnabled: s.billing_trials_enabled !== "false",
      trialDays: Number(s.billing_trial_days) || 7,
      taxEnabled: s.billing_tax_enabled !== "false",
      vatRate: Number(s.billing_vat_rate) || 0,
      requireVatNumber: s.billing_require_vat_number === "true",
      invoicePrefix: s.billing_invoice_prefix || "INV-",
      companyName: s.billing_company_name || "",
      referralEnabled: s.billing_referral_enabled === "true",
      refereeDiscountPercent: Number(s.billing_referral_referee_discount_percent) || 0,
      referrerRewardPercent: Number(s.billing_referral_referrer_reward_percent) || 0,
    };
  }),

  setBillingSettings: adminProcedure
    .input(
      z.object({
        enabled: z.boolean().optional(),
        defaultCurrency: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
        trialsEnabled: z.boolean().optional(),
        trialDays: z.number().int().min(1).max(365).optional(),
        taxEnabled: z.boolean().optional(),
        vatRate: z.number().min(0).max(100).optional(),
        requireVatNumber: z.boolean().optional(),
        invoicePrefix: z.string().max(50).optional(),
        companyName: z.string().max(255).optional(),
        referralEnabled: z.boolean().optional(),
        refereeDiscountPercent: z.number().int().min(0).max(100).optional(),
        referrerRewardPercent: z.number().int().min(0).max(100).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const pairs: Array<{ key: string; value: string }> = [];
      if (input.enabled !== undefined) pairs.push({ key: "billing_enabled", value: String(input.enabled) });
      if (input.defaultCurrency !== undefined) pairs.push({ key: "billing_default_currency", value: input.defaultCurrency });
      if (input.trialsEnabled !== undefined) pairs.push({ key: "billing_trials_enabled", value: String(input.trialsEnabled) });
      if (input.trialDays !== undefined) pairs.push({ key: "billing_trial_days", value: String(input.trialDays) });
      if (input.taxEnabled !== undefined) pairs.push({ key: "billing_tax_enabled", value: String(input.taxEnabled) });
      if (input.vatRate !== undefined) pairs.push({ key: "billing_vat_rate", value: String(input.vatRate) });
      if (input.requireVatNumber !== undefined) pairs.push({ key: "billing_require_vat_number", value: String(input.requireVatNumber) });
      if (input.invoicePrefix !== undefined) pairs.push({ key: "billing_invoice_prefix", value: input.invoicePrefix });
      if (input.companyName !== undefined) pairs.push({ key: "billing_company_name", value: input.companyName });
      if (input.referralEnabled !== undefined) pairs.push({ key: "billing_referral_enabled", value: String(input.referralEnabled) });
      if (input.refereeDiscountPercent !== undefined) pairs.push({ key: "billing_referral_referee_discount_percent", value: String(input.refereeDiscountPercent) });
      if (input.referrerRewardPercent !== undefined) pairs.push({ key: "billing_referral_referrer_reward_percent", value: String(input.referrerRewardPercent) });
      for (const { key, value } of pairs) {
        await db
          .insert(settings)
          .values({ key, value, updatedAt: new Date() })
          .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
      }
      context.revalidate?.();
      recordActivity({ eventType: "admin:settings.update", userId: context.session.user.id, ip: context.ip, properties: { keys: pairs.map((p) => p.key) } });
    }),
};
