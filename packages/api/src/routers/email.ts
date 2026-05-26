import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, settings } from "@struxa/db";
import { encrypt, safeDecrypt } from "../lib/crypto";
import { adminProcedure } from "../index";
import {
  buildSmtpTransporter,
  DEFAULT_TEMPLATES,
  TEMPLATE_NAMES,
  TEMPLATE_VARIABLES,
  getEmailTemplate,
  substituteVars,
} from "@struxa/auth/email";

const PASSWORD_SENTINEL = "[set]";

const SMTP_SETTINGS_KEYS = [
  "smtp_enabled",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_from_email",
  "smtp_from_name",
  "smtp_secure",
] as const;

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onDuplicateKeyUpdate({ set: { value, updatedAt: new Date() } });
}

export const emailRouter = {
  getSmtpConfig: adminProcedure.handler(async () => {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [...SMTP_SETTINGS_KEYS]));
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return {
      enabled: s.smtp_enabled === "true",
      host: s.smtp_host ?? "",
      port: s.smtp_port ?? "587",
      user: s.smtp_user ?? "",
      passwordSet: !!s.smtp_password,
      fromEmail: s.smtp_from_email ?? "",
      fromName: s.smtp_from_name ?? "",
      secure: s.smtp_secure === "true",
    };
  }),

  saveSmtpConfig: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        host: z.string().max(255),
        port: z.string().max(10),
        user: z.string().max(255),
        password: z.string().max(1000),
        fromEmail: z.string().max(255),
        fromName: z.string().max(255),
        secure: z.boolean(),
      }),
    )
    .handler(async ({ input }) => {
      await upsertSetting("smtp_enabled", String(input.enabled));
      await upsertSetting("smtp_host", input.host);
      await upsertSetting("smtp_port", input.port);
      await upsertSetting("smtp_user", input.user);
      await upsertSetting("smtp_from_email", input.fromEmail);
      await upsertSetting("smtp_from_name", input.fromName);
      await upsertSetting("smtp_secure", String(input.secure));

      if (input.password && input.password !== PASSWORD_SENTINEL) {
        await upsertSetting("smtp_password", encrypt(input.password));
      }
    }),

  testConnection: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input }) => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));

    if (s.smtp_enabled !== "true" || !s.smtp_host) {
      return { ok: false as const, error: "SMTP is not configured or disabled." };
    }

    const password = s.smtp_password ? safeDecrypt(s.smtp_password) : "";
    const transporter = buildSmtpTransporter({
      host: s.smtp_host,
      port: parseInt(s.smtp_port ?? "587", 10),
      user: s.smtp_user ?? "",
      password,
      fromEmail: s.smtp_from_email ?? "",
      fromName: s.smtp_from_name ?? "",
      secure: s.smtp_secure === "true",
    });

    try {
      await transporter.verify();
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Connection failed." };
    }

    const appName = s.app_name ?? "Struxa";
    const html = DEFAULT_TEMPLATES.verification({ appName, userName: "Admin", verificationUrl: "#test" });
    const from = s.smtp_from_name
      ? `"${s.smtp_from_name}" <${s.smtp_from_email}>`
      : s.smtp_from_email;

    try {
      await transporter.sendMail({
        from,
        to: input.email,
        subject: `[${appName}] SMTP test`,
        html,
      });
    } catch (err) {
      return {
        ok: false as const,
        error: `Verified but send failed: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }

    return { ok: true as const, email: input.email };
  }),

  getTemplate: adminProcedure
    .input(z.object({ name: z.enum(TEMPLATE_NAMES) }))
    .handler(async ({ input }) => {
      const customHtml = await getEmailTemplate(input.name);
      const sampleVars: Record<string, string> = {
        appName: "Struxa",
        userName: "John Doe",
        verificationUrl: "https://panel.example.com/verify?token=sample",
        resetUrl: "https://panel.example.com/reset?token=sample",
        serverName: "My Minecraft Server",
      };
      const defaultHtml = DEFAULT_TEMPLATES[input.name]?.(sampleVars) ?? "";
      return {
        customHtml: customHtml ?? null,
        defaultHtml,
        variables: TEMPLATE_VARIABLES[input.name] ?? [],
      };
    }),

  saveTemplate: adminProcedure
    .input(z.object({ name: z.enum(TEMPLATE_NAMES), html: z.string().max(200000) }))
    .handler(async ({ input }) => {
      const key = `email_template_${input.name}`;
      if (input.html.trim() === "") {
        await db.delete(settings).where(eq(settings.key, key));
      } else {
        await upsertSetting(key, input.html);
      }
    }),

  previewTemplate: adminProcedure
    .input(z.object({ name: z.enum(TEMPLATE_NAMES), html: z.string().max(200000).optional() }))
    .handler(async ({ input }) => {
      const sampleVars: Record<string, string> = {
        appName: "Struxa",
        userName: "John Doe",
        verificationUrl: "https://panel.example.com/verify?token=sample",
        resetUrl: "https://panel.example.com/reset?token=sample",
        serverName: "My Minecraft Server",
      };

      let html: string;
      if (input.html !== undefined) {
        html = substituteVars(input.html, sampleVars);
      } else {
        const custom = await getEmailTemplate(input.name);
        html = custom
          ? substituteVars(custom, sampleVars)
          : (DEFAULT_TEMPLATES[input.name]?.(sampleVars) ?? "");
      }
      return { html };
    }),
};
