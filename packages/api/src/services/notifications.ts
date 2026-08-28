import { eq } from "drizzle-orm";
import { db } from "@struxa/db";
import { settings } from "@struxa/db";
import { user as userTable } from "@struxa/db";
import { env } from "@struxa/env/server";
import { safeDecrypt } from "../lib/crypto";

export const SENTINEL = "[set]";

const TIMEOUT_MS = 8000;

export function isValidDiscordWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  return (
    u.protocol === "https:" &&
    (u.hostname === "discord.com" || u.hostname === "discordapp.com") &&
    u.pathname.startsWith("/api/webhooks/")
  );
}

export function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}

export function isValidTelegramChatId(id: string): boolean {
  return /^-?\d{5,}$/.test(id);
}

export async function postDiscord(url: string, payload: object): Promise<void> {
  if (!isValidDiscordWebhookUrl(url)) return;
  const res = await fetch(withComponentsParam(url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`discord ${res.status}`);
}

function withComponentsParam(url: string): string {
  return url.includes("?") ? `${url}&with_components=true` : `${url}?with_components=true`;
}

export async function postTelegram(token: string, chatId: string, text: string): Promise<void> {
  if (!isValidTelegramBotToken(token) || !isValidTelegramChatId(chatId)) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}`);
}

async function readSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export async function getAdminNotificationConfig() {
  const s = await readSettingsMap();
  return {
    appName: s.app_name ?? "Struxa",
    appUrl: env.APP_URL ?? s.app_url ?? "",
    discordEnabled: s.notifications_discord_enabled === "true",
    discordWebhookUrl: s.notifications_discord_webhook_url ? safeDecrypt(s.notifications_discord_webhook_url) : "",
    telegramEnabled: s.notifications_telegram_enabled === "true",
    telegramToken: s.notifications_telegram_bot_token ? safeDecrypt(s.notifications_telegram_bot_token) : "",
    telegramChatId: s.notifications_telegram_chat_id ?? "",
  };
}

export async function getUserNotificationConfig(userId: string) {
  const [s, owner] = await Promise.all([
    readSettingsMap(),
    db.query.user.findFirst({ where: eq(userTable.id, userId) }),
  ]);
  if (s.notifications_user_config_enabled !== "true" || !owner) return null;
  return {
    appName: s.app_name ?? "Struxa",
    appUrl: env.APP_URL ?? s.app_url ?? "",
    discordWebhookUrl: owner.notificationDiscordWebhook ? safeDecrypt(owner.notificationDiscordWebhook) : "",
    telegramToken: owner.notificationTelegramToken ? safeDecrypt(owner.notificationTelegramToken) : "",
    telegramChatId: owner.notificationTelegramChatId ?? "",
  };
}

export function notifyAdmins(kind: string, fields: Record<string, string> = {}): void {
  void (async () => {
    try {
      const cfg = await getAdminNotificationConfig();
      const message = buildMessage(kind, { ...fields, appName: cfg.appName });
      const components = buildDiscordComponents(kind, { ...fields, appName: cfg.appName, appUrl: cfg.appUrl });
      if (cfg.discordEnabled && cfg.discordWebhookUrl) await postDiscord(cfg.discordWebhookUrl, components);
      if (cfg.telegramEnabled && cfg.telegramToken && cfg.telegramChatId) {
        await postTelegram(cfg.telegramToken, cfg.telegramChatId, message);
      }
    } catch (e) {
      console.error("[notifications] admin send failed:", e);
    }
  })();
}

export function notifyServerOwner(ownerId: string, kind: string, fields: Record<string, string> = {}): void {
  if (!ownerId) return;
  void (async () => {
    try {
      const cfg = await getUserNotificationConfig(ownerId);
      if (!cfg) return;
      const message = buildMessage(kind, { ...fields, appName: cfg.appName });
      const components = buildDiscordComponents(kind, { ...fields, appName: cfg.appName, appUrl: cfg.appUrl });
      if (cfg.discordWebhookUrl) await postDiscord(cfg.discordWebhookUrl, components);
      if (cfg.telegramToken && cfg.telegramChatId) {
        await postTelegram(cfg.telegramToken, cfg.telegramChatId, message);
      }
    } catch (e) {
      console.error("[notifications] user send failed:", e);
    }
  })();
}

export function buildMessage(kind: string, fields: Record<string, string>): string {
  const prefix = fields.appName ?? "Struxa";
  switch (kind) {
    case "server-power":
      return `[${prefix}] Server "${fields.serverName}" ${fields.action} by ${fields.actor}`;
    case "backup":
      return `[${prefix}] Backup "${fields.backupName}" of "${fields.serverName}" ${fields.result}`;
    case "server-created":
      return `[${prefix}] Server "${fields.serverName}" created`;
    case "server-deleted":
      return `[${prefix}] Server "${fields.serverName}" deleted`;
    case "user-deleted":
      return `[${prefix}] User ${fields.userEmail} deleted`;
    case "payment":
      return `[${prefix}] Payment ${fields.result}${fields.amount ? `: ${fields.amount} ${fields.currency}` : ""} via ${fields.provider}`;
    case "test":
      return `[${prefix}] Test notification`;
    default:
      return `[${prefix}] ${fields.message ?? ""}`;
  }
}

const DISCORD_COMPONENTS_V2_FLAG = 32768;

export function buildDiscordComponents(kind: string, fields: Record<string, string>) {
  const appUrl = fields.appUrl ?? "";
  let title = "Notification";
  let subtitle = "";
  let detail = "";
  let buttonLabel = "Open panel";
  let buttonUrl: string | null = appUrl || null;

  switch (kind) {
    case "server-power":
      title = "Power action";
      subtitle = `${fields.serverName} was ${fields.action}ed by ${fields.actor}.`;
      detail = `**${fields.serverName}** · ${fields.action} by **${fields.actor}**`;
      buttonLabel = "View server";
      if (appUrl && fields.serverUuid) buttonUrl = `${appUrl}/servers/${fields.serverUuid}`;
      break;
    case "backup": {
      const result = fields.result ?? "";
      title = "Backup update";
      subtitle = `${fields.backupName} — ${result}.`;
      detail = `**${fields.backupName}** · ${fields.serverName}`;
      buttonLabel = "View server";
      if (appUrl && fields.serverUuid) buttonUrl = `${appUrl}/servers/${fields.serverUuid}`;
      break;
    }
    case "server-created":
      title = "Server created";
      subtitle = `${fields.serverName} has been created.`;
      detail = `**${fields.serverName}** · created by **${fields.actor}**`;
      buttonLabel = "View server";
      if (appUrl && fields.serverUuid) buttonUrl = `${appUrl}/servers/${fields.serverUuid}`;
      break;
    case "server-deleted":
      title = "Server deleted";
      subtitle = `${fields.serverName} has been deleted.`;
      detail = `**${fields.serverName}** · deleted by **${fields.actor}**`;
      buttonLabel = "View servers";
      if (appUrl) buttonUrl = `${appUrl}/admin/servers`;
      break;
    case "user-deleted":
      title = "User deleted";
      subtitle = "A user account has been deleted.";
      detail = `**${fields.userEmail}** · deleted by **${fields.actor}**`;
      buttonLabel = "View users";
      if (appUrl) buttonUrl = `${appUrl}/admin/users`;
      break;
    case "payment": {
      const received = fields.result === "received";
      title = received ? "Payment received" : "Payment failed";
      subtitle = received ? "A wallet top-up was received." : "A wallet top-up failed.";
      detail = fields.amount ? `**${fields.amount} ${fields.currency}** · ${fields.provider}` : `**${fields.provider}**`;
      buttonLabel = "View billing";
      if (appUrl) buttonUrl = `${appUrl}/admin/billing`;
      break;
    }
    case "test":
      title = "Test notification";
      subtitle = "Notifications are working.";
      detail = `**${fields.appName}** · Discord`;
      break;
  }

  return componentsPayload({ title, subtitle, detail, buttonLabel, buttonUrl });
}

function componentsPayload(v: { title: string; subtitle: string; detail: string; buttonLabel: string; buttonUrl: string | null }) {
  const header = `### ✦ ${v.title}\n${v.subtitle}`;
  const inner: unknown[] = [];
  if (v.buttonUrl) {
    inner.push({
      type: 9,
      components: [{ type: 10, content: header }],
      accessory: { type: 2, style: 5, label: v.buttonLabel, url: v.buttonUrl },
    });
    inner.push({ type:14, divider: true, spacing: 1 });
  } else {
    inner.push({ type: 10, content: header });
  }
  inner.push({ type: 10, content: v.detail });
  inner.push({ type: 10, content: `-# <t:${Math.floor(Date.now() / 1000)}:R>` });
  return {
    flags: DISCORD_COMPONENTS_V2_FLAG,
    components: [{ type: 17, accent_color: null, components: inner }],
  };
}
