export type { ProviderConfig, WebhookContext, WebhookPayload } from "./types";
export { createStripeTopupSession } from "./providers/stripe";
export { createSimPayTopupSession } from "./providers/simpay";
import { handleStripeWebhook } from "./providers/stripe";
import { handleSimPayWebhook } from "./providers/simpay";
import type { WebhookContext, WebhookPayload } from "./types";

export async function handleWebhook(
  provider: string,
  ctx: WebhookContext,
): Promise<WebhookPayload | null> {
  if (provider === "stripe") return handleStripeWebhook(ctx);
  if (provider === "simpay") return handleSimPayWebhook(ctx);
  return null;
}
