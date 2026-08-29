import type { WebhookContext, WebhookPayload } from "../types";

export interface PayPalTopupOptions {
  userId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  gatewayId: string;
}

function apiBase(sandbox?: boolean) {
  return sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

async function getAccessToken(config: { clientId: string; secret: string; sandbox?: boolean }): Promise<string> {
  const res = await fetch(`${apiBase(config.sandbox)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal auth failed: no access token");
  return data.access_token;
}

export async function createPayPalTopupSession(
  config: { clientId: string; secret: string; sandbox?: boolean },
  opts: PayPalTopupOptions,
): Promise<{ url: string; orderId: string }> {
  const token = await getAccessToken(config);
  const res = await fetch(`${apiBase(config.sandbox)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: opts.currency.toUpperCase(),
            value: (opts.amountCents / 100).toFixed(2),
          },
          custom_id: opts.userId,
        },
      ],
      application_context: {
        return_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
  });
  if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status}`);
  const order = (await res.json()) as {
    id: string;
    links?: { rel: string; href: string }[];
  };
  const approve = order.links?.find((l) => l.rel === "approve");
  if (!approve?.href) throw new Error("PayPal order has no approve URL");
  return { url: approve.href, orderId: order.id };
}

export async function handlePayPalWebhook(ctx: WebhookContext): Promise<WebhookPayload | null> {
  if (!ctx.config.webhookSecret) return null;

  let event: unknown;
  try {
    event = JSON.parse(ctx.rawBody);
  } catch {
    return null;
  }

  const verifyRes = await fetch(`${apiBase(ctx.config.sandbox)}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getAccessToken({
        clientId: ctx.config.publishableKey,
        secret: ctx.config.secretKey,
        sandbox: ctx.config.sandbox,
      })}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: ctx.headers["paypal-auth-algo"] ?? "",
      cert_url: ctx.headers["paypal-cert-url"] ?? "",
      transmission_id: ctx.headers["paypal-transmission-id"] ?? "",
      transmission_sig: ctx.headers["paypal-transmission-sig"] ?? "",
      transmission_time: ctx.headers["paypal-transmission-time"] ?? "",
      webhook_id: ctx.config.webhookSecret,
      webhook_event: event,
    }),
  });
  if (!verifyRes.ok) return null;
  const verification = (await verifyRes.json()) as { verification_status?: string };
  if (verification.verification_status !== "SUCCESS") return null;

  const e = event as {
    event_type?: string;
    resource?: { id?: string };
  };
  if (e.event_type !== "CHECKOUT.ORDER.APPROVED" || !e.resource?.id) return null;
  const orderId = e.resource.id;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) return null;
  const encodedOrderId = encodeURIComponent(orderId);

  const token = await getAccessToken({
    clientId: ctx.config.publishableKey,
    secret: ctx.config.secretKey,
    sandbox: ctx.config.sandbox,
  });
  const captureRes = await fetch(`${apiBase(ctx.config.sandbox)}/v2/checkout/orders/${encodedOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!captureRes.ok) return null;
  const capture = (await captureRes.json()) as {
    id?: string;
    status?: string;
    purchase_units?: {
      payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] };
      custom_id?: string;
      amount?: { value: string; currency_code: string };
    }[];
  };
  if (capture.status !== "COMPLETED") return null;

  const unit = capture.purchase_units?.[0];
  const capturedPayment = unit?.payments?.captures?.find((c) => c.status === "COMPLETED");
  const amount = capturedPayment?.amount ?? unit?.amount;
  const userId = unit?.custom_id;
  if (!userId || !amount) return null;

  const parsedAmount = parseFloat(amount.value);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;

  return {
    type: "topup.succeeded",
    userId,
    amountCents: Math.round(parsedAmount * 100),
    currency: amount.currency_code.toUpperCase(),
    providerTransactionId: capturedPayment?.id ?? capture.id ?? e.resource.id,
    gatewayId: ctx.gatewayId,
  };
}
