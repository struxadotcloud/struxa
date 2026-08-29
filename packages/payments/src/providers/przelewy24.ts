import { createHash, randomUUID } from "crypto";
import type { WebhookContext, WebhookPayload } from "../types";

export interface P24TopupOptions {
  userId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  statusUrl: string;
  gatewayId: string;
  customerEmail: string;
}

function apiBase(sandbox?: boolean) {
  return sandbox ? "https://sandbox.przelewy24.pl" : "https://secure.przelewy24.pl";
}

function basicAuth(posId: string, apiKey: string) {
  return `Basic ${Buffer.from(`${posId}:${apiKey}`).toString("base64")}`;
}

export async function createP24TopupSession(
  config: { merchantId: string; posId: string; apiKey: string; sandbox?: boolean },
  opts: P24TopupOptions,
): Promise<{ url: string; sessionId: string }> {
  const sessionId = `${opts.userId}:${randomUUID()}`;
  const res = await fetch(`${apiBase(config.sandbox)}/api/v1/transaction/register`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.posId, config.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      merchantId: config.merchantId,
      posId: config.posId,
      sessionId,
      amount: opts.amountCents,
      currency: opts.currency.toUpperCase(),
      description: "Wallet Top-Up",
      email: opts.customerEmail,
      country: "PL",
      urlReturn: opts.successUrl,
      urlStatus: opts.statusUrl,
    }),
  });
  if (!res.ok) throw new Error(`P24 transaction register failed: ${res.status}`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("P24 register failed: no token");
  return { url: `${apiBase(config.sandbox)}/trnRequest/${data.token}`, sessionId };
}

export async function handleP24Webhook(ctx: WebhookContext): Promise<WebhookPayload | null> {
  const crc = ctx.config.webhookSecret;
  if (!crc) return null;

  let n: {
    sessionId?: string;
    orderId?: number;
    amount?: number;
    currency?: string;
    sign?: string;
  };
  try {
    n = JSON.parse(ctx.rawBody) as typeof n;
  } catch {
    return null;
  }
  if (!n.sessionId || n.orderId === undefined || n.amount === undefined || !n.currency || !n.sign) return null;

  const expected = createHash("sha384")
    .update(`${n.sessionId}|${n.orderId}|${n.amount}|${n.currency}|${crc}`)
    .digest("hex");
  if (expected !== n.sign) return null;

  const userId = n.sessionId.split(":")[0];
  if (!userId) return null;

  const verifyRes = await fetch(`${apiBase(ctx.config.sandbox)}/api/v1/transaction/verify/${encodeURIComponent(n.sessionId)}`, {
    method: "GET",
    headers: { Authorization: basicAuth(ctx.config.serviceId ?? "", ctx.config.secretKey) },
  });
  if (!verifyRes.ok) return null;
  const verify = (await verifyRes.json()) as { data?: { status?: string; amount?: number; currency?: string } };
  const data = verify.data;
  if (data?.status !== "2") return null;

  return {
    type: "topup.succeeded",
    userId,
    amountCents: data.amount ?? n.amount,
    currency: (data.currency ?? n.currency).toUpperCase(),
    providerTransactionId: String(n.orderId),
    gatewayId: ctx.gatewayId,
  };
}
