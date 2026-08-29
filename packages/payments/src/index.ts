export type { ProviderConfig, WebhookContext, WebhookPayload } from "./types";
export { createStripeTopupSession } from "./providers/stripe";
export { createSimPayTopupSession } from "./providers/simpay";
export { createPayPalTopupSession } from "./providers/paypal";
export { createP24TopupSession } from "./providers/przelewy24";
import { handleStripeWebhook } from "./providers/stripe";
import { handleSimPayWebhook } from "./providers/simpay";
import { handlePayPalWebhook } from "./providers/paypal";
import { handleP24Webhook } from "./providers/przelewy24";
import type { WebhookContext, WebhookPayload } from "./types";

export async function handleWebhook(
  provider: string,
  ctx: WebhookContext,
): Promise<WebhookPayload | null> {
  if (provider === "stripe") return handleStripeWebhook(ctx);
  if (provider === "simpay") return handleSimPayWebhook(ctx);
  if (provider === "paypal") return handlePayPalWebhook(ctx);
  if (provider === "przelewy24") return handleP24Webhook(ctx);
  return null;
}
