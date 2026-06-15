import { SimPayClient } from "@simpay/typescript";
import type { PaymentIpnNotification } from "@simpay/typescript";
import type { WebhookContext, WebhookPayload } from "../types";

export interface SimPayTopupOptions {
  userId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  gatewayId: string;
  customerEmail: string;
  customerName?: string;
}

export async function createSimPayTopupSession(
  config: { apiPassword: string; serviceId: string },
  opts: SimPayTopupOptions,
): Promise<{ url: string }> {
  const simpay = new SimPayClient({
    api: { password: config.apiPassword },
    service: { id: config.serviceId },
    ipn: { signatureKey: "", validateSourceIp: false },
  });
  const tx = await simpay.payments.transactions.create(config.serviceId, {
    amount: opts.amountCents / 100,
    currency: opts.currency,
    description: "Wallet Top-Up",
    control: opts.userId,
    customer: { email: opts.customerEmail, name: opts.customerName },
    returns: { success: opts.successUrl, failure: opts.cancelUrl },
  });
  return { url: tx.redirectUrl };
}

export async function handleSimPayWebhook(ctx: WebhookContext): Promise<WebhookPayload | null> {
  const simpay = new SimPayClient({
    api: { password: ctx.config.secretKey },
    service: { id: ctx.config.serviceId ?? "" },
    ipn: { signatureKey: ctx.config.webhookSecret, validateSourceIp: false },
  });

  let payload: unknown;
  try {
    payload = JSON.parse(ctx.rawBody);
  } catch {
    return null;
  }

  try {
    await simpay.notifications.payment.verify({ payload, sourceIp: ctx.sourceIp });
  } catch {
    return null;
  }

  const n = payload as PaymentIpnNotification;
  if (n.type === "transaction:status_changed" && n.data.status === "transaction_paid") {
    const data = n.data;
    if (!data.control) return null;
    return {
      type: "topup.succeeded",
      userId: data.control,
      amountCents: Math.round(parseFloat(data.amount.original_value) * 100),
      currency: data.amount.original_currency.toUpperCase(),
      providerTransactionId: data.payer_transaction_id || data.id,
      gatewayId: ctx.gatewayId,
    };
  }

  return null;
}
