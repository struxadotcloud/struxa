import { db, settings } from "@struxa/db";
import { env } from "@struxa/env/server";
import { safeDecrypt } from "./lib/crypto";

const TIMEOUT_MS = 8000;

export function notifyAdminsSignup(userEmail: string, userName: string): void {
  void (async () => {
    try {
      const rows = await db.select().from(settings);
      const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
      if (
        s.notifications_discord_enabled !== "true" &&
        s.notifications_telegram_enabled !== "true"
      ) {
        return;
      }
      const appName = s.app_name ?? "Struxa";
      const appUrl = env.APP_URL ?? s.app_url ?? "";
      const message = `[${appName}] New user registered: ${userEmail} (${userName})`;
      if (s.notifications_discord_enabled === "true" && s.notifications_discord_webhook_url) {
        const url = safeDecrypt(s.notifications_discord_webhook_url);
        const header = `### ✦ User created\nA new member has joined your ${appName} workspace.`;
        const inner: unknown[] = [];
        if (appUrl) {
          inner.push(
            {
              type: 9,
              components: [{ type: 10, content: header }],
              accessory: { type: 2, style: 5, label: "View user", url: `${appUrl}/admin/users` },
            },
            { type: 14, divider: true, spacing: 1 },
          );
        } else {
          inner.push({ type: 10, content: header });
        }
        inner.push({ type: 10, content: `**${userEmail}** · ${userName}` });
        inner.push({ type: 10, content: `-# <t:${Math.floor(Date.now() / 1000)}:R>` });
        await fetch(url.includes("?") ? `${url}&with_components=true` : `${url}?with_components=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flags: 32768,
            allowed_mentions: { parse: [] },
            components: [{ type: 17, accent_color: null, components: inner }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      }
      if (
        s.notifications_telegram_enabled === "true" &&
        s.notifications_telegram_bot_token &&
        s.notifications_telegram_chat_id
      ) {
        const token = safeDecrypt(s.notifications_telegram_bot_token);
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: s.notifications_telegram_chat_id, text: message }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      }
    } catch {}
  })();
}
