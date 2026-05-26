import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { db, settings } from "@struxa/db";
import { safeDecrypt } from "./lib/crypto";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secure: boolean;
}

export interface EmailService {
  transporter: Transporter;
  fromEmail: string;
  fromName: string;
}

export function buildSmtpTransporter(config: SmtpConfig): Transporter {
  // Port 465 = implicit TLS (secure: true). All other ports use STARTTLS:
  // if the user wants TLS, set requireTLS: true so the upgrade is mandatory.
  const implicitTls = config.port === 465;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: implicitTls,
    requireTLS: !implicitTls && config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });
}

export async function buildEmailServiceFromSettings(): Promise<EmailService | null> {
  const rows = await db.select().from(settings);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));

  if (s.smtp_enabled !== "true") return null;
  if (!s.smtp_host) return null;

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

  return {
    transporter,
    fromEmail: s.smtp_from_email ?? "",
    fromName: s.smtp_from_name ?? "",
  };
}

export async function getEmailTemplate(name: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, `email_template_${name}`),
  });
  return row?.value ?? null;
}

export function substituteVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function sendEmail(
  service: EmailService,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const from = service.fromName
    ? `"${service.fromName}" <${service.fromEmail}>`
    : service.fromEmail;
  await service.transporter.sendMail({ from, to, subject, html });
}

const BASE_STYLE = `
  body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .wrapper { padding: 40px 16px; }
  .card { background: #ffffff; border-radius: 12px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .header { background: #18181b; padding: 24px 32px; }
  .header h1 { margin: 0; color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
  .body { padding: 32px; }
  .body h2 { margin: 0 0 8px; color: #18181b; font-size: 20px; font-weight: 600; }
  .body p { margin: 0 0 16px; color: #52525b; font-size: 14px; line-height: 1.6; }
  .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; }
  .footer { padding: 0 32px 24px; }
  .footer p { margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.5; }
  .divider { border: none; border-top: 1px solid #f4f4f5; margin: 0 32px 24px; }
`.trim();

function baseTemplate(appName: string, header: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${header}</title>
<style>${BASE_STYLE}</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header"><h1>${appName}</h1></div>
    <div class="body">${body}</div>
    <hr class="divider" />
    <div class="footer"><p>This email was sent by ${appName}. If you didn't expect this, you can safely ignore it.</p></div>
  </div>
</div>
</body>
</html>`;
}

export const TEMPLATE_NAMES = ["verification", "password-reset", "welcome", "server-install"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const DEFAULT_TEMPLATES: Record<TemplateName, (vars: Record<string, string>) => string> = {
  verification: (vars) =>
    baseTemplate(
      vars.appName ?? "Struxa",
      "Verify your email",
      `<h2>Verify your email address</h2>
<p>Hi ${vars.userName ?? "there"},</p>
<p>Thanks for signing up. Click the button below to verify your email address and activate your account.</p>
<p><a class="btn" href="${vars.verificationUrl ?? "#"}">Verify Email</a></p>
<p style="font-size:12px;color:#a1a1aa;">Button not working? Copy and paste this link into your browser:<br><a href="${vars.verificationUrl ?? "#"}" style="color:#52525b;word-break:break-all;">${vars.verificationUrl ?? ""}</a></p>`,
    ),

  "password-reset": (vars) =>
    baseTemplate(
      vars.appName ?? "Struxa",
      "Reset your password",
      `<h2>Reset your password</h2>
<p>Hi ${vars.userName ?? "there"},</p>
<p>We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in 1 hour.</p>
<p><a class="btn" href="${vars.resetUrl ?? "#"}">Reset Password</a></p>
<p style="font-size:12px;color:#a1a1aa;">If you didn't request a password reset, you can safely ignore this email. Your password won't change.<br><br>Button not working? Copy and paste this link:<br><a href="${vars.resetUrl ?? "#"}" style="color:#52525b;word-break:break-all;">${vars.resetUrl ?? ""}</a></p>`,
    ),

  welcome: (vars) =>
    baseTemplate(
      vars.appName ?? "Struxa",
      `Welcome to ${vars.appName ?? "Struxa"}`,
      `<h2>Welcome to ${vars.appName ?? "Struxa"}!</h2>
<p>Hi ${vars.userName ?? "there"},</p>
<p>Your account has been created and is ready to use. You can now log in and start managing your servers.</p>
<p>If you have any questions, reach out to your panel administrator.</p>`,
    ),

  "server-install": (vars) =>
    baseTemplate(
      vars.appName ?? "Struxa",
      "Server installation complete",
      `<h2>Your server is ready</h2>
<p>Hi ${vars.userName ?? "there"},</p>
<p>Your server <strong>${vars.serverName ?? "your server"}</strong> has finished installing and is ready to start.</p>
<p>Log in to your panel to start and manage your server.</p>`,
    ),
};

export const TEMPLATE_VARIABLES: Record<TemplateName, string[]> = {
  verification: ["appName", "userName", "verificationUrl", "verificationToken"],
  "password-reset": ["appName", "userName", "resetUrl", "resetToken"],
  welcome: ["appName", "userName"],
  "server-install": ["appName", "userName", "serverName"],
};
