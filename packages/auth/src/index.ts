import { eq } from "drizzle-orm";
import { createDecipheriv } from "crypto";
import { db, settings } from "@struxa/db";
import * as schema from "@struxa/db/schema/auth";
import { env } from "@struxa/env/server";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, twoFactor } from "better-auth/plugins";

function safeDecrypt(value: string): string {
  try {
    const key = Buffer.from(env.DATABASE_ENCRYPTION_KEY, "hex");
    const [ivHex, tagHex, encHex] = value.split(":");
    if (!ivHex || !tagHex || !encHex) return value;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return value;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthInstance = any;

let _auth: AuthInstance | null = null;
let _authPromise: Promise<AuthInstance> | null = null;

async function buildAuth(): Promise<AuthInstance> {
  const rows = await db.select().from(settings);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  const appName = env.APP_NAME ?? s.app_name ?? "Struxa";
  const appUrl = env.APP_URL ?? s.app_url ?? "";
  const baseURL = env.BETTER_AUTH_URL ?? appUrl;
  const corsOrigin = env.CORS_ORIGIN ?? appUrl;

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (s.github_enabled === "true" && s.github_client_id && s.github_client_secret) {
    socialProviders.github = { clientId: s.github_client_id, clientSecret: safeDecrypt(s.github_client_secret) };
  }
  if (s.discord_enabled === "true" && s.discord_client_id && s.discord_client_secret) {
    socialProviders.discord = { clientId: s.discord_client_id, clientSecret: safeDecrypt(s.discord_client_secret) };
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "mysql",
      schema: schema,
    }),
    trustedOrigins: corsOrigin ? [corsOrigin] : [],
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    socialProviders,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: baseURL || undefined,
    appName,
    onAPIError: {
      errorURL: appUrl ? `${appUrl}/auth/error` : "/auth/error",
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const row = await db.query.settings.findFirst({
          where: eq(settings.key, "registration_enabled"),
        });
        if (row?.value === "false") {
          throw new APIError("FORBIDDEN", { message: "Registration is disabled." });
        }
      }),
    },
    plugins: [
      nextCookies(),
      admin(),
      twoFactor({ issuer: appName }),
      apiKey(),
      ...(env.TURNSTILE_SECRET_KEY
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: env.TURNSTILE_SECRET_KEY,
            }),
          ]
        : []),
    ],
  });
}

export function getAuth(): Promise<AuthInstance> {
  if (_auth) return Promise.resolve(_auth);
  if (!_authPromise) {
    _authPromise = buildAuth().then((a) => {
      _auth = a;
      return a;
    });
  }
  return _authPromise;
}
