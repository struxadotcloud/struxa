import { eq } from "drizzle-orm";
import { db, settings } from "@struxa/db";
import * as schema from "@struxa/db/schema/auth";
import { env } from "@struxa/env/server";
import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, twoFactor } from "better-auth/plugins";
import { safeDecrypt } from "./lib/crypto";
import {
  buildEmailServiceFromSettings,
  getEmailTemplate,
  DEFAULT_TEMPLATES,
  substituteVars,
  sendEmail,
} from "./email";

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
      sendResetPassword: async ({ user, url }) => {
        const svc = await buildEmailServiceFromSettings();
        if (!svc) return;
        const custom = await getEmailTemplate("password-reset");
        const resetToken = (() => { try { return new URL(url).searchParams.get("token") ?? ""; } catch { return ""; } })();
        const vars = { appName, userName: user.name ?? user.email, resetUrl: url, resetToken };
        const html = custom
          ? substituteVars(custom, vars)
          : DEFAULT_TEMPLATES["password-reset"](vars);
        await sendEmail(svc, user.email, `Reset your ${appName} password`, html);
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const svc = await buildEmailServiceFromSettings();
        if (!svc) {
          // Email disabled — auto-verify so email/password signups aren't permanently locked out.
          // Social logins auto-verify; this keeps consistent behaviour when no email service is set.
          await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
          return;
        }
        const verificationToken = (() => { try { return new URL(url).searchParams.get("token") ?? ""; } catch { return ""; } })();
        const custom = await getEmailTemplate("verification");
        const vars = { appName, userName: user.name ?? user.email, verificationUrl: url, verificationToken };
        const html = custom
          ? substituteVars(custom, vars)
          : DEFAULT_TEMPLATES.verification(vars);
        await sendEmail(svc, user.email, `Verify your ${appName} email`, html);
      },
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
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const newUser = ctx.context.newSession?.user;
        if (!newUser) return;
        void (async () => {
          try {
            const svc = await buildEmailServiceFromSettings();
            if (!svc) return;
            const custom = await getEmailTemplate("welcome");
            const vars = { appName, userName: newUser.name ?? newUser.email };
            const html = custom
              ? substituteVars(custom, vars)
              : DEFAULT_TEMPLATES.welcome(vars);
            await sendEmail(svc, newUser.email, `Welcome to ${appName}`, html);
          } catch {
            // non-critical
          }
        })();
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
