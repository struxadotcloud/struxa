import Stripe from "stripe";
import type { WebhookContext, WebhookPayload } from "../types";

export interface StripeTopupOptions {
  userId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  gatewayId: string;
}

export async function createStripeTopupSession(
  config: { secretKey: string },
  opts: StripeTopupOptions,
): Promise<{ sessionId: string; url: string }> {
  const stripe = new Stripe(config.secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: opts.currency.toLowerCase(),
          product_data: { name: "Wallet Top-Up" },
          unit_amount: opts.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: {
      userId: opts.userId,
      gatewayId: opts.gatewayId,
      type: "wallet_topup",
    },
  });
  if (!session.url) throw new Error("Stripe session has no URL");
  return { sessionId: session.id, url: session.url };
}

export async function handleStripeWebhook(ctx: WebhookContext): Promise<WebhookPayload | null> {
  const sig = ctx.headers["stripe-signature"] ?? "";
  if (!ctx.config.webhookSecret) return null;

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(ctx.rawBody, sig, ctx.config.webhookSecret);
  } catch {
    return null;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (
      session.metadata?.type === "wallet_topup" &&
      session.payment_status === "paid" &&
      session.metadata.userId &&
      session.metadata.gatewayId
    ) {
      if (!session.amount_total || session.amount_total <= 0) return null;
      return {
        type: "topup.succeeded",
        userId: session.metadata.userId,
        amountCents: session.amount_total,
        currency: (session.currency ?? "usd").toUpperCase(),
        providerTransactionId: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
        gatewayId: session.metadata.gatewayId,
      };
    }
  }

  return null;
}
