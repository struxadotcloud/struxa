import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  billingPaymentGateways,
  billingReferralRedemptions,
  billingWallet,
  billingWalletTransactions,
  billingTransactions,
  settings,
} from "@struxa/db";
import { decrypt } from "@struxa/api/lib/crypto";
import { handleWebhook } from "@struxa/payments";
import type { WebhookPayload } from "@struxa/payments";
import { randomUUID } from "crypto";

async function addWalletCredits(userId: string, amountCents: number, currency: string, description: string) {
  const walletRow = await db.query.billingWallet.findFirst({ where: eq(billingWallet.userId, userId) });
  let balanceBefore = 0;
  if (walletRow) {
    balanceBefore = walletRow.balanceCents;
    await db.update(billingWallet).set({ balanceCents: walletRow.balanceCents + amountCents }).where(eq(billingWallet.userId, userId));
  } else {
    await db.insert(billingWallet).values({ id: randomUUID(), userId, balanceCents: amountCents, currency });
  }
  await db.insert(billingWalletTransactions).values({
    id: randomUUID(),
    userId,
    amountCents,
    balanceAfterCents: balanceBefore + amountCents,
    currency,
    type: "adjustment",
    description,
  });
}

async function creditWallet(payload: Extract<WebhookPayload, { type: "topup.succeeded" }>) {
  const existing = await db.query.billingTransactions.findFirst({
    where: eq(billingTransactions.providerTransactionId, payload.providerTransactionId),
  });
  if (existing) return;

  const currency = payload.currency.toUpperCase();

  const walletRow = await db.query.billingWallet.findFirst({
    where: eq(billingWallet.userId, payload.userId),
  });

  let balanceBefore = 0;
  if (walletRow) {
    balanceBefore = walletRow.balanceCents;
    await db
      .update(billingWallet)
      .set({ balanceCents: walletRow.balanceCents + payload.amountCents })
      .where(eq(billingWallet.userId, payload.userId));
  } else {
    await db.insert(billingWallet).values({
      id: randomUUID(),
      userId: payload.userId,
      balanceCents: payload.amountCents,
      currency,
    });
  }

  const balanceAfter = balanceBefore + payload.amountCents;

  await db.insert(billingWalletTransactions).values({
    id: randomUUID(),
    userId: payload.userId,
    amountCents: payload.amountCents,
    balanceAfterCents: balanceAfter,
    currency,
    type: "topup",
    description: "Wallet top-up via payment provider",
  });

  await db.insert(billingTransactions).values({
    id: randomUUID(),
    userId: payload.userId,
    gatewayId: payload.gatewayId,
    type: "payment",
    status: "succeeded",
    amountCents: payload.amountCents,
    currency,
    providerTransactionId: payload.providerTransactionId,
  });

  const redemption = await db.query.billingReferralRedemptions.findFirst({
    where: and(
      eq(billingReferralRedemptions.refereeId, payload.userId),
      isNull(billingReferralRedemptions.firstTopupAt),
    ),
  });

  if (redemption) {
    const settingsRows = await db.select().from(settings);
    const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value ?? ""]));
    if (s.billing_referral_enabled !== "true") return;

    const refereeDiscountPercent = Number(s.billing_referral_referee_discount_percent) || 0;
    const referrerRewardPercent = Number(s.billing_referral_referrer_reward_percent) || 0;

    await db.update(billingReferralRedemptions)
      .set({ firstTopupAt: new Date() })
      .where(eq(billingReferralRedemptions.id, redemption.id));

    if (refereeDiscountPercent > 0) {
      const bonusCents = Math.round(payload.amountCents * refereeDiscountPercent / 100);
      await addWalletCredits(payload.userId, bonusCents, currency, `Referral bonus — ${refereeDiscountPercent}% top-up reward`);
    }

    if (referrerRewardPercent > 0) {
      const rewardCents = Math.round(payload.amountCents * referrerRewardPercent / 100);
      await addWalletCredits(redemption.referrerId, rewardCents, currency, `Referral commission — ${referrerRewardPercent}% of referred top-up`);
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  const gateway = await db.query.billingPaymentGateways.findFirst({
    where: and(
      eq(billingPaymentGateways.provider, provider),
      eq(billingPaymentGateways.isActive, true),
    ),
  });

  if (!gateway) return new Response("Not found", { status: 404 });

  const raw = gateway.config as {
    publishableKey?: string; secretKey?: string; webhookSecret?: string; serviceId?: string;
  } | null ?? {};

  const sourceIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? undefined;

  const config = {
    publishableKey: raw.publishableKey ?? "",
    secretKey: raw.secretKey ? decrypt(raw.secretKey) : "",
    webhookSecret: raw.webhookSecret ? decrypt(raw.webhookSecret) : "",
    serviceId: raw.serviceId,
  };

  const payload = await handleWebhook(provider, { rawBody, headers, config, gatewayId: gateway.id, sourceIp });

  if (payload?.type === "topup.succeeded") {
    await creditWallet(payload);
  }

  return new Response("OK", { status: 200 });
}
