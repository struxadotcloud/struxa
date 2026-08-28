import { eq } from "drizzle-orm";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@struxa/db";
import { settings } from "@struxa/db";
import { user } from "@struxa/db";
import { encrypt } from "../lib/crypto";
import { recordActivity } from "../services/activity";
import { adminProcedure, protectedProcedure } from "../index";
import {
  SENTINEL,
  buildDiscordComponents,
  buildMessage,
  getAdminNotificationConfig,
  getUserNotificationConfig,
  isValidDiscordWebhookUrl,
  isValidTelegramBotToken,
  isValidTelegramChatId,
  postDiscord,
  postTelegram,
} from "../services/notifications";

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
}

function resolveSecret(
  input: string | undefined,
  validate: (v: string) => void,
): "keep" | "clear" | string {
  if (input === undefined || input === SENTINEL) return "keep";
  if (input === "") return "clear";
  validate(input);
  return input;
}

export const notificationsRouter = {
  getAdminConfig: adminProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return {
      discordEnabled: s.notifications_discord_enabled === "true",
      discordWebhookSet: !!s.notifications_discord_webhook_url,
      telegramEnabled: s.notifications_telegram_enabled === "true",
      telegramTokenSet: !!s.notifications_telegram_bot_token,
      telegramChatId: s.notifications_telegram_chat_id ?? "",
      userConfigEnabled: s.notifications_user_config_enabled === "true",
    };
  }),

  saveAdminConfig: adminProcedure
    .input(
      z.object({
        discordEnabled: z.boolean().optional(),
        discordWebhookUrl: z.string().max(500).optional(),
        telegramEnabled: z.boolean().optional(),
        telegramBotToken: z.string().max(300).optional(),
        telegramChatId: z.string().max(64).optional(),
        userConfigEnabled: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const pairs: Array<{ key: string; value: string }> = [];
      if (input.discordEnabled !== undefined) pairs.push({ key: "notifications_discord_enabled", value: String(input.discordEnabled) });
      if (input.telegramEnabled !== undefined) pairs.push({ key: "notifications_telegram_enabled", value: String(input.telegramEnabled) });
      if (input.userConfigEnabled !== undefined) pairs.push({ key: "notifications_user_config_enabled", value: String(input.userConfigEnabled) });

      const discordWebhook = resolveSecret(input.discordWebhookUrl, (v) => {
        if (!isValidDiscordWebhookUrl(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Discord webhook URL" });
      });
      if (discordWebhook === "clear") {
        await db.delete(settings).where(eq(settings.key, "notifications_discord_webhook_url"));
      } else if (discordWebhook !== "keep") {
        pairs.push({ key: "notifications_discord_webhook_url", value: encrypt(discordWebhook) });
      }

      const telegramToken = resolveSecret(input.telegramBotToken, (v) => {
        if (!isValidTelegramBotToken(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Telegram bot token" });
      });
      if (telegramToken === "clear") {
        await db.delete(settings).where(eq(settings.key, "notifications_telegram_bot_token"));
      } else if (telegramToken !== "keep") {
        pairs.push({ key: "notifications_telegram_bot_token", value: encrypt(telegramToken) });
      }

      const telegramChatId = resolveSecret(input.telegramChatId, (v) => {
        if (!isValidTelegramChatId(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Telegram chat id" });
      });
      if (telegramChatId === "clear") {
        await db.delete(settings).where(eq(settings.key, "notifications_telegram_chat_id"));
      } else if (telegramChatId !== "keep") {
        pairs.push({ key: "notifications_telegram_chat_id", value: telegramChatId });
      }

      for (const { key, value } of pairs) {
        await upsertSetting(key, value);
      }
      context.revalidate?.();
      recordActivity({ eventType: "admin:settings.update", userId: context.session.user.id, ip: context.ip, properties: { keys: pairs.map((p) => p.key) } });
    }),

  test: adminProcedure
    .input(z.object({ channel: z.enum(["discord", "telegram"]) }))
    .handler(async ({ input }) => {
      const cfg = await getAdminNotificationConfig();
      const message = buildMessage("test", { appName: cfg.appName });
      try {
        if (input.channel === "discord") {
          if (!cfg.discordEnabled || !cfg.discordWebhookUrl) {
            return { ok: false as const, error: "Discord is not configured or disabled" };
          }
          await postDiscord(cfg.discordWebhookUrl, buildDiscordComponents("test", { appName: cfg.appName }));
        } else {
          if (!cfg.telegramEnabled || !cfg.telegramToken || !cfg.telegramChatId) {
            return { ok: false as const, error: "Telegram is not configured or disabled" };
          }
          await postTelegram(cfg.telegramToken, cfg.telegramChatId, message);
        }
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "Send failed" };
      }
    }),

  getUserConfig: protectedProcedure.handler(async ({ context }) => {
    const row = await db.query.settings.findFirst({
      where: eq(settings.key, "notifications_user_config_enabled"),
    });
    if (row?.value !== "true") return { enabled: false as const };
    const me = await db.query.user.findFirst({
      where: eq(user.id, context.session.user.id),
    });
    return {
      enabled: true as const,
      discordWebhookSet: !!me?.notificationDiscordWebhook,
      telegramTokenSet: !!me?.notificationTelegramToken,
      telegramChatId: me?.notificationTelegramChatId ?? "",
    };
  }),

  saveUserConfig: protectedProcedure
    .input(
      z.object({
        discordWebhookUrl: z.string().max(500).optional(),
        telegramBotToken: z.string().max(300).optional(),
        telegramChatId: z.string().max(64).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const row = await db.query.settings.findFirst({
        where: eq(settings.key, "notifications_user_config_enabled"),
      });
      if (row?.value !== "true") {
        throw new ORPCError("FORBIDDEN", { message: "User notifications are disabled" });
      }

      const updates: Record<string, string | null> = {};
      const discordWebhook = resolveSecret(input.discordWebhookUrl, (v) => {
        if (!isValidDiscordWebhookUrl(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Discord webhook URL" });
      });
      if (discordWebhook === "clear") updates.notificationDiscordWebhook = null;
      else if (discordWebhook !== "keep") updates.notificationDiscordWebhook = encrypt(discordWebhook);

      const telegramToken = resolveSecret(input.telegramBotToken, (v) => {
        if (!isValidTelegramBotToken(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Telegram bot token" });
      });
      if (telegramToken === "clear") updates.notificationTelegramToken = null;
      else if (telegramToken !== "keep") updates.notificationTelegramToken = encrypt(telegramToken);

      const telegramChatId = resolveSecret(input.telegramChatId, (v) => {
        if (!isValidTelegramChatId(v)) throw new ORPCError("BAD_REQUEST", { message: "Invalid Telegram chat id" });
      });
      if (telegramChatId === "clear") updates.notificationTelegramChatId = null;
      else if (telegramChatId !== "keep") updates.notificationTelegramChatId = telegramChatId;

      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, context.session.user.id));
      }
    }),

  testUser: protectedProcedure
    .input(z.object({ channel: z.enum(["discord", "telegram"]) }))
    .handler(async ({ context, input }) => {
      const cfg = await getUserNotificationConfig(context.session.user.id);
      if (!cfg) return { ok: false as const, error: "User notifications are disabled" };
      const message = buildMessage("test", { appName: cfg.appName });
      try {
        if (input.channel === "discord") {
          if (!cfg.discordWebhookUrl) {
            return { ok: false as const, error: "Discord webhook is not configured" };
          }
          await postDiscord(cfg.discordWebhookUrl, buildDiscordComponents("test", { appName: cfg.appName }));
        } else {
          if (!cfg.telegramToken || !cfg.telegramChatId) {
            return { ok: false as const, error: "Telegram is not configured" };
          }
          await postTelegram(cfg.telegramToken, cfg.telegramChatId, message);
        }
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "Send failed" };
      }
    }),
};
