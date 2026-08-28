import { eq } from "drizzle-orm";
import { db, settings } from "@struxa/db";
import * as schema from "@struxa/db/schema/auth";
import { env } from "@struxa/env/server";
import { apiKey } from "@better-auth/api-key";
import { i18n } from "@better-auth/i18n";
import { betterAuth } from "better-auth";
export { hashPassword } from "better-auth/crypto";
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
import { notifyAdminsSignup } from "./notifications";

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
    user: {
      changeEmail: {
        enabled: true,
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }, request) => {
        const isChangeEmail =
          typeof request?.url === "string" &&
          new URL(request.url).pathname.endsWith("/change-email");
        const svc = await buildEmailServiceFromSettings();
        if (!svc) {
          if (isChangeEmail) {
            await db.update(schema.user)
              .set({ email: user.email, emailVerified: true })
              .where(eq(schema.user.id, user.id));
            return;
          }
          await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
          return;
        }
        const verificationToken = (() => { try { return new URL(url).searchParams.get("token") ?? ""; } catch { return ""; } })();
        const templateName = isChangeEmail ? "change-email" : "verification";
        const custom = await getEmailTemplate(templateName);
        const vars = { appName, userName: user.name ?? user.email, verificationUrl: url, verificationToken };
        const html = custom
          ? substituteVars(custom, vars)
          : DEFAULT_TEMPLATES[templateName](vars);
        const subject = isChangeEmail
          ? `Confirm your new ${appName} email`
          : `Verify your ${appName} email`;
        await sendEmail(svc, user.email, subject, html);
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
        notifyAdminsSignup(newUser.email ?? "", newUser.name ?? "");
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
      i18n({
        detection: ["cookie", "header"],
        localeCookie: "NEXT_LOCALE",
        translations: {
          pl: {
            INVALID_EMAIL_OR_PASSWORD: "Nieprawidłowy adres e-mail lub hasło.",
            USER_NOT_FOUND: "Nie znaleziono użytkownika.",
            USER_EMAIL_NOT_FOUND: "Nie znaleziono użytkownika z tym adresem e-mail.",
            INVALID_PASSWORD: "Nieprawidłowe hasło.",
            EMAIL_NOT_VERIFIED: "Adres e-mail nie został zweryfikowany.",
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Użytkownik z tym adresem e-mail już istnieje.",
            PASSWORD_TOO_SHORT: "Hasło jest za krótkie.",
            PASSWORD_TOO_LONG: "Hasło jest za długie.",
            SESSION_EXPIRED: "Sesja wygasła. Zaloguj się ponownie.",
            CREDENTIAL_ACCOUNT_NOT_FOUND: "Nie znaleziono konta.",
            FAILED_TO_CREATE_USER: "Nie udało się utworzyć konta. Spróbuj ponownie.",
            FAILED_TO_CREATE_SESSION: "Nie udało się utworzyć sesji. Spróbuj ponownie.",
          },
          de: {
            INVALID_EMAIL_OR_PASSWORD: "Ungültige E-Mail-Adresse oder Passwort.",
            USER_NOT_FOUND: "Benutzer nicht gefunden.",
            USER_EMAIL_NOT_FOUND: "Kein Benutzer mit dieser E-Mail-Adresse gefunden.",
            INVALID_PASSWORD: "Ungültiges Passwort.",
            EMAIL_NOT_VERIFIED: "E-Mail-Adresse ist nicht verifiziert.",
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ein Benutzer mit dieser E-Mail-Adresse existiert bereits.",
            PASSWORD_TOO_SHORT: "Das Passwort ist zu kurz.",
            PASSWORD_TOO_LONG: "Das Passwort ist zu lang.",
            SESSION_EXPIRED: "Sitzung abgelaufen. Bitte erneut anmelden.",
            CREDENTIAL_ACCOUNT_NOT_FOUND: "Konto nicht gefunden.",
            FAILED_TO_CREATE_USER: "Konto konnte nicht erstellt werden. Bitte erneut versuchen.",
            FAILED_TO_CREATE_SESSION: "Sitzung konnte nicht erstellt werden. Bitte erneut versuchen.",
          },
          es: {
            INVALID_EMAIL_OR_PASSWORD: "Correo electrónico o contraseña incorrectos.",
            USER_NOT_FOUND: "Usuario no encontrado.",
            USER_EMAIL_NOT_FOUND: "No se encontró ningún usuario con ese correo electrónico.",
            INVALID_PASSWORD: "Contraseña incorrecta.",
            EMAIL_NOT_VERIFIED: "El correo electrónico no está verificado.",
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe un usuario con este correo electrónico.",
            PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
            PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
            SESSION_EXPIRED: "La sesión ha expirado. Inicia sesión de nuevo.",
            CREDENTIAL_ACCOUNT_NOT_FOUND: "Cuenta no encontrada.",
            FAILED_TO_CREATE_USER: "No se pudo crear la cuenta. Inténtalo de nuevo.",
            FAILED_TO_CREATE_SESSION: "No se pudo crear la sesión. Inténtalo de nuevo.",
          },
          fr: {
            INVALID_EMAIL_OR_PASSWORD: "Adresse e-mail ou mot de passe incorrect.",
            USER_NOT_FOUND: "Utilisateur introuvable.",
            USER_EMAIL_NOT_FOUND: "Aucun utilisateur trouvé avec cette adresse e-mail.",
            INVALID_PASSWORD: "Mot de passe incorrect.",
            EMAIL_NOT_VERIFIED: "L'adresse e-mail n'est pas vérifiée.",
            USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un utilisateur avec cette adresse e-mail existe déjà.",
            PASSWORD_TOO_SHORT: "Le mot de passe est trop court.",
            PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
            SESSION_EXPIRED: "Session expirée. Veuillez vous reconnecter.",
            CREDENTIAL_ACCOUNT_NOT_FOUND: "Compte introuvable.",
            FAILED_TO_CREATE_USER: "Impossible de créer le compte. Veuillez réessayer.",
            FAILED_TO_CREATE_SESSION: "Impossible de créer la session. Veuillez réessayer.",
          },
        },
      }),
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
