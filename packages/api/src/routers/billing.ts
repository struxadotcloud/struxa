import { randomBytes, randomUUID } from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@struxa/db";
import {
  billingCategories,
  billingCouponRedemptions,
  billingCoupons,
  billingInvoiceItems,
  billingInvoices,
  billingPaymentGateways,
  billingPlans,
  billingPlanPrices,
  billingProducts,
  billingReferralCodes,
  billingReferralRedemptions,
  billingSubscriptions,
  billingTransactions,
  billingWallet,
  billingWalletTransactions,
  eggs,
  nodeAllocations,
  nodes,
  serverVariables,
  servers,
  settings,
} from "@struxa/db";
import { recordActivity } from "../services/activity";
import { getEffectiveAppUrl } from "../services/instance";
import { encrypt, decrypt } from "../lib/crypto";
import { createWingsClient } from "../lib/wings-client";
import { buildInvocation } from "../services/wings-servers";
import { createStripeTopupSession, createSimPayTopupSession, createPayPalTopupSession, createP24TopupSession } from "@struxa/payments";
import { adminProcedure, protectedProcedure } from "../index";

const DURATION_DAYS: Record<string, number> = {
  "7day": 7,
  "1month": 30,
  "3months": 90,
  "6months": 180,
  "1year": 365,
};


function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const DURATIONS = ["7day", "1month", "3months", "6months", "1year"] as const;

type NodeCapacityEntry = { remainingRamMB: number; remainingDiskMB: number; freeAllocCount: number };
let _capacityCache: { data: Map<string, NodeCapacityEntry>; expiresAt: number } | null = null;

async function getNodeCapacityMap(): Promise<Map<string, NodeCapacityEntry>> {
  if (_capacityCache && Date.now() < _capacityCache.expiresAt) return _capacityCache.data;

  const freeAllocs = await db.query.nodeAllocations.findMany({
    where: isNull(nodeAllocations.serverId),
    with: { node: true },
  });

  const freeCountByNode = new Map<string, number>();
  for (const a of freeAllocs) freeCountByNode.set(a.nodeId, (freeCountByNode.get(a.nodeId) ?? 0) + 1);

  const map = new Map<string, NodeCapacityEntry>();
  for (const a of freeAllocs) {
    if (map.has(a.nodeId)) continue;
    const node = a.node as typeof nodes.$inferSelect;
    const [usage] = await db.select({
      usedRam: sql<number>`COALESCE(SUM(${servers.memory}), 0)`,
      usedDisk: sql<number>`COALESCE(SUM(${servers.disk}), 0)`,
    }).from(servers).where(eq(servers.nodeId, a.nodeId));
    const maxRam = node.memory * (1 + node.memoryOverallocate / 100);
    const maxDisk = node.disk * (1 + node.diskOverallocate / 100);
    map.set(a.nodeId, {
      remainingRamMB: maxRam - Number(usage?.usedRam ?? 0),
      remainingDiskMB: maxDisk - Number(usage?.usedDisk ?? 0),
      freeAllocCount: freeCountByNode.get(a.nodeId) ?? 0,
    });
  }

  // ponytail: process-local cache; resets on deploy. Fine for a 2-min soft stock check
  _capacityCache = { data: map, expiresAt: Date.now() + 2 * 60 * 1000 };
  return map;
}

export function invalidateCapacityCache() {
  _capacityCache = null;
}

const resourceLimitsSchema = z.object({
  cpu: z.number().min(0),
  ram: z.number().min(0),
  disk: z.number().min(0),
  backups: z.number().int().min(0),
  allocations: z.number().int().min(0),
  databases: z.number().int().min(0),
  eggs: z.array(z.string()),
  nodes: z.array(z.string()).optional(),
});

export const billingRouter = {
  getConfig: protectedProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return {
      enabled: s.billing_enabled !== "false",
      referralEnabled: s.billing_referral_enabled === "true",
      defaultCurrency: s.billing_default_currency || "USD",
    };
  }),

  listCategories: protectedProcedure.handler(async () => {
    const rows = await db
      .select()
      .from(billingCategories)
      .where(eq(billingCategories.isActive, true))
      .orderBy(asc(billingCategories.sortOrder));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      icon: r.icon ?? "",
      bannerUrl: r.coverImage ?? "",
    }));
  }),

  listProducts: protectedProcedure
    .input(z.object({ categoryId: z.string().uuid().optional() }).optional())
    .handler(async ({ input }) => {
      const [products, nodeCapacity] = await Promise.all([
        db.query.billingProducts.findMany({
          where: input?.categoryId
            ? and(eq(billingProducts.isActive, true), eq(billingProducts.categoryId, input.categoryId))
            : eq(billingProducts.isActive, true),
          orderBy: [asc(billingProducts.sortOrder)],
          with: {
            plans: {
              where: and(eq(billingPlans.isActive, true), eq(billingPlans.isPublic, true)),
              with: { prices: { where: eq(billingPlanPrices.isActive, true) } },
            },
          },
        }),
        getNodeCapacityMap(),
      ]);

      return products
        .filter((p) => p.plans.length > 0)
        .map((product) => {
          const plan = product.plans[0]!;
          const limits = plan.resourceLimits as {
            cpu?: number; ram?: number; disk?: number;
            backups?: number; allocations?: number; databases?: number; eggs?: string[]; nodes?: string[];
          } | null;
          const allowedNodes = (limits?.nodes ?? []) as string[];
          const requiredRamMB = (limits?.ram ?? 0) * 1024;
          const requiredDiskMB = (limits?.disk ?? 0) * 1024;
          let soldOut = true;
          for (const [nodeId, cap] of nodeCapacity) {
            if (allowedNodes.length > 0 && !allowedNodes.includes(nodeId)) continue;
            if (cap.freeAllocCount > 0 && cap.remainingRamMB >= requiredRamMB && cap.remainingDiskMB >= requiredDiskMB) {
              soldOut = false;
              break;
            }
          }
          return {
            id: product.id,
            planId: plan.id,
            categoryId: product.categoryId ?? "",
            name: product.name,
            description: product.description ?? "",
            isFeatured: product.isFeatured,
            icon: product.icon ?? "",
            currency: plan.currency,
            soldOut,
            resources: {
              cpu: limits?.cpu ?? 0,
              ram: limits?.ram ?? 0,
              disk: limits?.disk ?? 0,
              backups: limits?.backups ?? 0,
              allocations: limits?.allocations ?? 0,
              databases: limits?.databases ?? 0,
              eggs: limits?.eggs ?? [],
            },
            prices: plan.prices.map((p) => ({
              id: p.id,
              duration: p.duration,
              price: p.priceCents / 100,
            })),
          };
        });
    }),

  getWallet: protectedProcedure.handler(async ({ context }) => {
    const row = await db.query.billingWallet.findFirst({
      where: eq(billingWallet.userId, context.session.user.id),
    });
    if (row) return { balanceCents: row.balanceCents, currency: row.currency };
    const currencyRow = await db.query.settings.findFirst({
      where: eq(settings.key, "billing_default_currency"),
    });
    return { balanceCents: 0, currency: currencyRow?.value ?? "USD" };
  }),

  listWalletTransactions: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() }).optional())
    .handler(async ({ context, input }) => {
      const rows = await db.query.billingWalletTransactions.findMany({
        where: eq(billingWalletTransactions.userId, context.session.user.id),
        orderBy: [desc(billingWalletTransactions.createdAt)],
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        amountCents: r.amountCents,
        balanceAfterCents: r.balanceAfterCents,
        currency: r.currency,
        description: r.description ?? "",
        createdAt: r.createdAt,
      }));
    }),

  listActiveGateways: protectedProcedure.handler(async () => {
    const rows = await db.query.billingPaymentGateways.findMany({
      where: eq(billingPaymentGateways.isActive, true),
      orderBy: [asc(billingPaymentGateways.sortOrder)],
      columns: { id: true, name: true, provider: true },
    });
    return rows;
  }),

  createTopupSession: protectedProcedure
    .input(z.object({
      gatewayId: z.string(),
      amountCents: z.number().int().min(100),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .handler(async ({ context, input }) => {
      const gateway = await db.query.billingPaymentGateways.findFirst({
        where: and(eq(billingPaymentGateways.id, input.gatewayId), eq(billingPaymentGateways.isActive, true)),
      });
      if (!gateway) throw new Error("Payment gateway not found or inactive");

      const raw = gateway.config as {
        publishableKey?: string; secretKey?: string; serviceId?: string; webhookSecret?: string; sandbox?: string;
      } | null ?? {};

      const wallet = await db.query.billingWallet.findFirst({
        where: eq(billingWallet.userId, context.session.user.id),
      });
      const currencyRow = await db.query.settings.findFirst({
        where: eq(settings.key, "billing_default_currency"),
      });
      const currency = wallet?.currency ?? currencyRow?.value ?? "USD";

      if (gateway.provider === "stripe") {
        if (!raw.secretKey) throw new Error("Stripe secret key not configured");
        const { url } = await createStripeTopupSession(
          { secretKey: decrypt(raw.secretKey) },
          {
            userId: context.session.user.id,
            amountCents: input.amountCents,
            currency,
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            gatewayId: gateway.id,
          },
        );
        return { url };
      }

      if (gateway.provider === "simpay") {
        if (!raw.secretKey) throw new Error("SimPay API password not configured");
        if (!raw.serviceId) throw new Error("SimPay service ID not configured");
        const { url } = await createSimPayTopupSession(
          { apiPassword: decrypt(raw.secretKey), serviceId: raw.serviceId },
          {
            userId: context.session.user.id,
            amountCents: input.amountCents,
            currency,
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            gatewayId: gateway.id,
            customerEmail: context.session.user.email,
            customerName: context.session.user.name ?? undefined,
          },
        );
        return { url };
      }

      if (gateway.provider === "paypal") {
        if (!raw.publishableKey) throw new Error("PayPal client ID not configured");
        if (!raw.secretKey) throw new Error("PayPal secret not configured");
        const { url } = await createPayPalTopupSession(
          { clientId: raw.publishableKey, secret: decrypt(raw.secretKey), sandbox: raw.sandbox === "true" },
          {
            userId: context.session.user.id,
            amountCents: input.amountCents,
            currency,
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            gatewayId: gateway.id,
          },
        );
        return { url };
      }

      if (gateway.provider === "przelewy24") {
        if (!raw.publishableKey) throw new Error("P24 merchant ID not configured");
        if (!raw.serviceId) throw new Error("P24 POS ID not configured");
        if (!raw.secretKey) throw new Error("P24 API key not configured");
        if (!raw.webhookSecret) throw new Error("P24 CRC not configured");
        const appUrl = await getEffectiveAppUrl();
        if (!appUrl) throw new Error("App URL not configured");
        const { url } = await createP24TopupSession(
          {
            merchantId: raw.publishableKey,
            posId: raw.serviceId,
            apiKey: decrypt(raw.secretKey),
            sandbox: raw.sandbox === "true",
          },
          {
            userId: context.session.user.id,
            amountCents: input.amountCents,
            currency,
            successUrl: input.successUrl,
            cancelUrl: input.cancelUrl,
            statusUrl: new URL(`/api/billing/webhook/${gateway.provider}`, appUrl).toString(),
            gatewayId: gateway.id,
            customerEmail: context.session.user.email,
          },
        );
        return { url };
      }

      throw new Error(`Unsupported payment provider: ${gateway.provider}`);
    }),

  adminListCategories: adminProcedure.handler(async () => {
    const rows = await db.select().from(billingCategories).orderBy(asc(billingCategories.sortOrder));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description ?? "",
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      icon: r.icon ?? "",
      bannerUrl: r.coverImage ?? "",
    }));
  }),

  adminCreateCategory: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        slug: z.string().max(255).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        icon: z.string().optional(),
        coverImage: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      const slug = input.slug || slugify(input.name);
      await db.insert(billingCategories).values({
        id,
        name: input.name,
        slug,
        description: input.description,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        icon: input.icon,
        coverImage: input.coverImage,
      });
      recordActivity({ eventType: "admin:billing.category.create", userId: context.session.user.id, ip: context.ip, properties: { name: input.name } });
    }),

  adminUpdateCategory: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().max(255).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        icon: z.string().nullable().optional(),
        coverImage: z.string().nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      await db.update(billingCategories).set(data).where(eq(billingCategories.id, id));
      recordActivity({ eventType: "admin:billing.category.update", userId: context.session.user.id, ip: context.ip, properties: { id } });
    }),

  adminDeleteCategory: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const products = await db.select().from(billingProducts).where(eq(billingProducts.categoryId, input.id));
      for (const product of products) {
        await db.delete(billingPlans).where(eq(billingPlans.productId, product.id));
        await db.delete(billingProducts).where(eq(billingProducts.id, product.id));
      }
      await db.delete(billingCategories).where(eq(billingCategories.id, input.id));
      recordActivity({ eventType: "admin:billing.category.delete", userId: context.session.user.id, ip: context.ip, properties: { id: input.id } });
    }),

  adminListProducts: adminProcedure.handler(async () => {
    const products = await db.query.billingProducts.findMany({
      orderBy: asc(billingProducts.sortOrder),
      with: {
        plans: {
          with: { prices: true },
        },
      },
    });
    return products.map((product) => {
      const plan = product.plans[0];
      const limits = plan?.resourceLimits as {
        cpu?: number; ram?: number; disk?: number;
        backups?: number; allocations?: number; databases?: number; eggs?: string[]; nodes?: string[];
      } | null;
      return {
        id: product.id,
        categoryId: product.categoryId ?? "",
        name: product.name,
        description: product.description ?? "",
        isFeatured: product.isFeatured,
        isActive: plan?.isActive ?? true,
        isPublic: plan?.isPublic ?? true,
        icon: product.icon ?? "",
        resources: {
          cpu: limits?.cpu ?? 1,
          ram: limits?.ram ?? 1,
          disk: limits?.disk ?? 10,
          backups: limits?.backups ?? 0,
          allocations: limits?.allocations ?? 1,
          databases: limits?.databases ?? 0,
          eggs: limits?.eggs ?? [],
          nodes: limits?.nodes ?? [],
        },
        prices: (plan?.prices ?? []).map((p) => ({
          id: p.id,
          duration: p.duration,
          price: p.priceCents / 100,
        })),
      };
    });
  }),

  adminCreateProduct: adminProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        name: z.string().min(1).max(255),
        slug: z.string().max(255).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        icon: z.string().optional(),
        resourceLimits: resourceLimitsSchema,
        prices: z.array(
          z.object({
            duration: z.enum(DURATIONS),
            priceCents: z.number().int().min(0),
          }),
        ),
        currency: z.string().length(3).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const durations = input.prices.map((p) => p.duration);
      if (new Set(durations).size !== durations.length) throw new ORPCError("BAD_REQUEST", { message: "Duplicate price durations" });

      const productId = randomUUID();
      const planId = randomUUID();
      const slug = input.slug || slugify(input.name);

      const currencySettingRow = await db.query.settings.findFirst({ where: eq(settings.key, "billing_default_currency") });
      const defaultCurrencyForPlan = input.currency ?? currencySettingRow?.value ?? "USD";

      await db.transaction(async (tx) => {
        if (input.isFeatured && input.categoryId) {
          await tx.update(billingProducts).set({ isFeatured: false }).where(eq(billingProducts.categoryId, input.categoryId));
        }
        await tx.insert(billingProducts).values({
          id: productId,
          categoryId: input.categoryId,
          name: input.name,
          slug,
          description: input.description,
          isActive: input.isActive ?? true,
          isFeatured: input.isFeatured ?? false,
          icon: input.icon,
          sortOrder: 0,
        });
        await tx.insert(billingPlans).values({
          id: planId,
          productId,
          name: input.name,
          description: input.description,
          currency: defaultCurrencyForPlan,
          resourceLimits: input.resourceLimits,
          isActive: input.isActive ?? true,
          isPublic: input.isPublic ?? true,
          sortOrder: 0,
        });
        if (input.prices.length > 0) {
          await tx.insert(billingPlanPrices).values(
            input.prices.map((p) => ({ id: randomUUID(), planId, duration: p.duration, priceCents: p.priceCents, isActive: true })),
          );
        }
      });

      recordActivity({ eventType: "admin:billing.product.create", userId: context.session.user.id, ip: context.ip, properties: { name: input.name } });
      return { id: productId };
    }),

  adminUpdateProduct: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid().optional().nullable(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().max(255).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        icon: z.string().nullable().optional(),
        resourceLimits: resourceLimitsSchema.optional(),
        prices: z
          .array(
            z.object({
              duration: z.enum(DURATIONS),
              priceCents: z.number().int().min(0),
            }),
          )
          .optional(),
        currency: z.string().length(3).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      if (input.isFeatured) {
        const product = await db.query.billingProducts.findFirst({ where: eq(billingProducts.id, input.id) });
        const catId = input.categoryId ?? product?.categoryId;
        if (catId) {
          await db.update(billingProducts).set({ isFeatured: false }).where(eq(billingProducts.categoryId, catId));
        }
      }

      await db.update(billingProducts).set({
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
        ...(input.icon !== undefined && { icon: input.icon }),
      }).where(eq(billingProducts.id, input.id));

      const existingPlan = await db.query.billingPlans.findFirst({
        where: eq(billingPlans.productId, input.id),
      });

      if (existingPlan) {
        await db.update(billingPlans).set({
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(input.resourceLimits !== undefined && { resourceLimits: input.resourceLimits }),
        }).where(eq(billingPlans.id, existingPlan.id));

        if (input.prices !== undefined) {
          const existingPrices = await db.select().from(billingPlanPrices).where(eq(billingPlanPrices.planId, existingPlan.id));
          const existingByDuration = new Map(existingPrices.map((p) => [p.duration, p]));

          for (const p of input.prices) {
            const existing = existingByDuration.get(p.duration);
            if (existing) {
              await db.update(billingPlanPrices).set({ priceCents: p.priceCents }).where(eq(billingPlanPrices.id, existing.id));
            } else {
              await db.insert(billingPlanPrices).values({ id: randomUUID(), planId: existingPlan.id, duration: p.duration, priceCents: p.priceCents, isActive: true });
            }
          }

          const incomingDurations = input.prices.map((p) => p.duration);
          const toDelete = existingPrices.filter((p) => !incomingDurations.includes(p.duration));
          if (toDelete.length > 0) {
            const referencedIds = (await db.select({ id: billingSubscriptions.priceId }).from(billingSubscriptions).where(inArray(billingSubscriptions.priceId, toDelete.map((p) => p.id)))).map((r) => r.id);
            const safeToDelete = toDelete.filter((p) => !referencedIds.includes(p.id));
            if (safeToDelete.length > 0) {
              await db.delete(billingPlanPrices).where(inArray(billingPlanPrices.id, safeToDelete.map((p) => p.id)));
            }
          }
        }
      }

      recordActivity({ eventType: "admin:billing.product.update", userId: context.session.user.id, ip: context.ip, properties: { id: input.id } });
    }),

  adminDeleteProduct: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await db.delete(billingPlans).where(eq(billingPlans.productId, input.id));
      await db.delete(billingProducts).where(eq(billingProducts.id, input.id));
      recordActivity({ eventType: "admin:billing.product.delete", userId: context.session.user.id, ip: context.ip, properties: { id: input.id } });
    }),

  adminListGateways: adminProcedure.handler(async () => {
    const rows = await db
      .select()
      .from(billingPaymentGateways)
      .orderBy(asc(billingPaymentGateways.sortOrder));
    return rows.map((r) => {
      const config = r.config as { publishableKey?: string; secretKey?: string; webhookSecret?: string; sandbox?: string } | null ?? {};
      return {
        id: r.id,
        name: r.name,
        provider: r.provider,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        hasPublishableKey: !!config.publishableKey,
        hasSecretKey: !!config.secretKey,
        hasWebhookSecret: !!config.webhookSecret,
        sandbox: config.sandbox === "true",
      };
    });
  }),

  adminCreateGateway: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        provider: z.string().min(1).max(100),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        publishableKey: z.string().optional(),
        secretKey: z.string().optional(),
        webhookSecret: z.string().optional(),
        serviceId: z.string().optional(),
        sandbox: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      const config: Record<string, string> = {};
      if (input.publishableKey) config.publishableKey = input.publishableKey;
      if (input.secretKey) config.secretKey = encrypt(input.secretKey);
      if (input.webhookSecret) config.webhookSecret = encrypt(input.webhookSecret);
      if (input.serviceId) config.serviceId = input.serviceId;
      if (input.sandbox) config.sandbox = "true";
      await db.insert(billingPaymentGateways).values({
        id,
        name: input.name,
        provider: input.provider,
        config,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      });
      recordActivity({ eventType: "admin:billing.gateway.create", userId: context.session.user.id, ip: context.ip, properties: { name: input.name, provider: input.provider } });
      return { id };
    }),

  adminUpdateGateway: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        publishableKey: z.string().optional(),
        secretKey: z.string().optional(),
        webhookSecret: z.string().optional(),
        serviceId: z.string().optional(),
        sandbox: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await db.query.billingPaymentGateways.findFirst({
        where: eq(billingPaymentGateways.id, input.id),
      });
      if (!existing) throw new Error("Gateway not found");

      const existingConfig = existing.config as { publishableKey?: string; secretKey?: string; webhookSecret?: string; serviceId?: string } | null ?? {};
      const config: Record<string, string> = { ...existingConfig as Record<string, string> };
      if (input.publishableKey !== undefined && input.publishableKey !== "") config.publishableKey = input.publishableKey;
      if (input.secretKey !== undefined && input.secretKey !== "") config.secretKey = encrypt(input.secretKey);
      if (input.webhookSecret !== undefined && input.webhookSecret !== "") config.webhookSecret = encrypt(input.webhookSecret);
      if (input.serviceId !== undefined && input.serviceId !== "") config.serviceId = input.serviceId;
      if (input.sandbox !== undefined) config.sandbox = String(input.sandbox);

      await db.update(billingPaymentGateways).set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        config,
      }).where(eq(billingPaymentGateways.id, input.id));

      recordActivity({ eventType: "admin:billing.gateway.update", userId: context.session.user.id, ip: context.ip, properties: { id: input.id } });
    }),

  adminDeleteGateway: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      await db.delete(billingPaymentGateways).where(eq(billingPaymentGateways.id, input.id));
      recordActivity({ eventType: "admin:billing.gateway.delete", userId: context.session.user.id, ip: context.ip, properties: { id: input.id } });
    }),

  getReferralCode: protectedProcedure.handler(async ({ context }) => {
    const row = await db.query.billingReferralCodes.findFirst({
      where: eq(billingReferralCodes.userId, context.session.user.id),
    });
    if (!row) return null;
    return { code: row.code, usageCount: row.usageCount };
  }),

  generateReferralCode: protectedProcedure
    .input(z.object({ code: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/) }))
    .handler(async ({ context, input }) => {
      const existing = await db.query.billingReferralCodes.findFirst({
        where: eq(billingReferralCodes.userId, context.session.user.id),
      });
      if (existing) return { code: existing.code, usageCount: existing.usageCount };

      const code = input.code.toUpperCase();
      const taken = await db.query.billingReferralCodes.findFirst({
        where: eq(billingReferralCodes.code, code),
      });
      if (taken) throw new ORPCError("CONFLICT", { data: { code: "CODE_TAKEN" } });

      await db.insert(billingReferralCodes).values({
        id: randomUUID(),
        userId: context.session.user.id,
        code,
      });
      return { code, usageCount: 0 };
    }),

  updateReferralCode: protectedProcedure
    .input(z.object({ code: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/) }))
    .handler(async ({ context, input }) => {
      const existing = await db.query.billingReferralCodes.findFirst({
        where: eq(billingReferralCodes.userId, context.session.user.id),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { data: { code: "CODE_NOT_FOUND" } });

      const code = input.code.toUpperCase();
      if (code === existing.code) return { code, usageCount: existing.usageCount };

      const taken = await db.query.billingReferralCodes.findFirst({
        where: eq(billingReferralCodes.code, code),
      });
      if (taken) throw new ORPCError("CONFLICT", { data: { code: "CODE_TAKEN" } });

      await db.update(billingReferralCodes)
        .set({ code })
        .where(eq(billingReferralCodes.id, existing.id));
      return { code, usageCount: existing.usageCount };
    }),

  applyReferralCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(50) }))
    .handler(async ({ context, input }) => {
      const alreadyApplied = await db.query.billingReferralRedemptions.findFirst({
        where: eq(billingReferralRedemptions.refereeId, context.session.user.id),
      });
      if (alreadyApplied) throw new ORPCError("BAD_REQUEST", { data: { code: "ALREADY_APPLIED" } });

      const referralCode = await db.query.billingReferralCodes.findFirst({
        where: and(eq(billingReferralCodes.code, input.code.toUpperCase()), eq(billingReferralCodes.isActive, true)),
      });
      if (!referralCode) throw new ORPCError("NOT_FOUND", { data: { code: "CODE_NOT_FOUND" } });
      if (referralCode.userId === context.session.user.id) throw new ORPCError("BAD_REQUEST", { data: { code: "SELF_REFERRAL" } });

      await db.insert(billingReferralRedemptions).values({
        id: randomUUID(),
        codeId: referralCode.id,
        refereeId: context.session.user.id,
        referrerId: referralCode.userId,
      });
      await db.update(billingReferralCodes)
        .set({ usageCount: sql`${billingReferralCodes.usageCount} + 1` })
        .where(eq(billingReferralCodes.id, referralCode.id));

      return { success: true };
    }),

  listSubscriptions: protectedProcedure.handler(async ({ context }) => {
    const rows = await db.query.billingSubscriptions.findMany({
      where: and(
        eq(billingSubscriptions.userId, context.session.user.id),
        ne(billingSubscriptions.status, "canceled"),
      ),
      with: {
        plan: { columns: { id: true, name: true } },
        price: { columns: { duration: true, priceCents: true } },
      },
      orderBy: [desc(billingSubscriptions.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      planId: r.planId,
      planName: r.plan?.name ?? "",
      duration: r.price?.duration ?? "",
      priceCents: r.price?.priceCents ?? 0,
      currency: r.currency,
      currentPeriodStart: r.currentPeriodStart,
      currentPeriodEnd: r.currentPeriodEnd,
      cancelAtPeriodEnd: r.cancelAtPeriodEnd,
    }));
  }),

  getActiveSubscription: protectedProcedure.handler(async ({ context }) => {
    const row = await db.query.billingSubscriptions.findFirst({
      where: and(
        eq(billingSubscriptions.userId, context.session.user.id),
        or(
          eq(billingSubscriptions.status, "active"),
          eq(billingSubscriptions.status, "trialing"),
        ),
      ),
      with: {
        plan: true,
        price: { columns: { duration: true, priceCents: true } },
      },
      orderBy: [desc(billingSubscriptions.createdAt)],
    });
    if (!row) return null;
    const limits = row.plan?.resourceLimits as {
      cpu?: number; ram?: number; disk?: number;
      backups?: number; allocations?: number; databases?: number; eggs?: string[];
    } | null;
    return {
      id: row.id,
      status: row.status,
      planId: row.planId,
      planName: row.plan?.name ?? "",
      duration: row.price?.duration ?? "",
      priceCents: row.price?.priceCents ?? 0,
      currency: row.currency,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      resourceLimits: {
        cpu: limits?.cpu ?? 0,
        ram: limits?.ram ?? 0,
        disk: limits?.disk ?? 0,
        backups: limits?.backups ?? 0,
        allocations: limits?.allocations ?? 0,
        databases: limits?.databases ?? 0,
        eggs: limits?.eggs ?? [],
      },
    };
  }),

  listPlanEggs: protectedProcedure
    .input(z.object({ planId: z.string().optional() }))
    .handler(async ({ input }) => {
      if (!input.planId) return [];
      const plan = await db.query.billingPlans.findFirst({
        where: eq(billingPlans.id, input.planId),
        columns: { resourceLimits: true },
      });
      const limits = plan?.resourceLimits as { eggs?: string[] } | null;
      const eggIds = limits?.eggs ?? [];
      if (eggIds.length === 0) return [];
      const rows = await db.query.eggs.findMany({
        where: inArray(eggs.id, eggIds),
        columns: { id: true, name: true, dockerImages: true },
        with: {
          variables: {
            columns: { id: true, name: true, description: true, envVariable: true, defaultValue: true, userViewable: true, userEditable: true },
          },
        },
      });
      return rows.map((row) => {
        let imagesMap: Record<string, string> = {};
        try { imagesMap = JSON.parse(row.dockerImages as unknown as string) as Record<string, string>; } catch {}
        return {
          id: row.id,
          name: row.name,
          dockerImages: Object.entries(imagesMap).map(([name, image]) => ({ name, image })),
          variables: row.variables.filter((v) => v.userViewable),
        };
      });
    }),

  purchasePlan: protectedProcedure
    .input(z.object({
      priceId: z.string().uuid(),
      eggId: z.string().uuid(),
      serverName: z.string().min(1).max(255),
      couponCode: z.string().optional(),
      dockerImage: z.string().optional(),
      envVars: z.record(z.string(), z.string()).optional(),
    }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const priceRow = await db.query.billingPlanPrices.findFirst({
        where: and(eq(billingPlanPrices.id, input.priceId), eq(billingPlanPrices.isActive, true)),
        with: { plan: true },
      });
      if (!priceRow?.plan) throw new ORPCError("NOT_FOUND", { message: "Plan or price not found" });

      const plan = priceRow.plan;
      if (!plan.isActive || !plan.isPublic) throw new ORPCError("NOT_FOUND", { message: "Plan is not active" });

      const planLimits = plan.resourceLimits as {
        cpu?: number; ram?: number; disk?: number;
        backups?: number; allocations?: number; databases?: number; eggs?: string[]; nodes?: string[];
      } | null;

      const allowedEggs = planLimits?.eggs ?? [];
      if (allowedEggs.length > 0 && !allowedEggs.includes(input.eggId)) {
        throw new ORPCError("BAD_REQUEST", { message: "Egg not allowed for this plan" });
      }

      const eggRow = await db.query.eggs.findFirst({
        where: eq(eggs.id, input.eggId),
        with: { variables: true },
      });
      if (!eggRow) throw new ORPCError("NOT_FOUND", { message: "Egg not found" });

      const allowedNodeIds = (planLimits?.nodes ?? []) as string[];
      const requiredRam = (planLimits?.ram ?? 0.5) * 1024;
      const requiredDisk = (planLimits?.disk ?? 1) * 1024;

      const freeAllocs = await db.query.nodeAllocations.findMany({
        where: and(
          isNull(nodeAllocations.serverId),
          allowedNodeIds.length > 0 ? inArray(nodeAllocations.nodeId, allowedNodeIds) : undefined,
        ),
        with: { node: true },
      });

      // ponytail: soft capacity check — two concurrent buys can both pass; overallocation headroom absorbs the slop
      const nodeUsageCache = new Map<string, { usedRam: number; usedDisk: number }>();
      let alloc: (typeof freeAllocs)[0] | null = null;

      for (const candidate of freeAllocs) {
        const nodeId = candidate.nodeId;
        if (!nodeUsageCache.has(nodeId)) {
          const [usage] = await db.select({
            usedRam: sql<number>`COALESCE(SUM(${servers.memory}), 0)`,
            usedDisk: sql<number>`COALESCE(SUM(${servers.disk}), 0)`,
          }).from(servers).where(eq(servers.nodeId, nodeId));
          nodeUsageCache.set(nodeId, { usedRam: Number(usage?.usedRam ?? 0), usedDisk: Number(usage?.usedDisk ?? 0) });
        }
        const node = candidate.node as typeof nodes.$inferSelect;
        const usage = nodeUsageCache.get(nodeId)!;
        const maxRam = node.memory * (1 + node.memoryOverallocate / 100);
        const maxDisk = node.disk * (1 + node.diskOverallocate / 100);
        if (usage.usedRam + requiredRam <= maxRam && usage.usedDisk + requiredDisk <= maxDisk) {
          alloc = candidate;
          break;
        }
      }

      if (!alloc) {
        const hasAnyFree = freeAllocs.length > 0;
        throw new ORPCError("BAD_REQUEST", { data: { code: hasAnyFree ? "NO_CAPACITY" : "NO_ALLOCATIONS" } });
      }

      const wallet = await db.query.billingWallet.findFirst({
        where: eq(billingWallet.userId, userId),
      });
      const settingsRows = await db.select().from(settings);
      const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value ?? ""]));
      const currency = (s.billing_default_currency || "USD").toUpperCase();

      let discountCents = 0;
      let couponRow: typeof billingCoupons.$inferSelect | null = null;
      if (input.couponCode) {
        const now = new Date();
        couponRow = await db.query.billingCoupons.findFirst({
          where: and(
            eq(billingCoupons.code, input.couponCode.toUpperCase()),
            eq(billingCoupons.isActive, true),
            or(isNull(billingCoupons.planId), eq(billingCoupons.planId, plan.id)),
          ),
        }) ?? null;
        if (
          couponRow &&
          (!couponRow.redeemBy || couponRow.redeemBy > now) &&
          (couponRow.maxRedemptions === null || couponRow.timesRedeemed < couponRow.maxRedemptions)
        ) {
          const alreadyUsed = await db.query.billingCouponRedemptions.findFirst({
            where: and(
              eq(billingCouponRedemptions.couponId, couponRow.id),
              eq(billingCouponRedemptions.userId, userId),
            ),
          });
          if (!alreadyUsed) {
            if (couponRow.discountType === "percentage") {
              discountCents = Math.round(priceRow.priceCents * couponRow.discountValue / 100);
            } else {
              discountCents = couponRow.discountValue;
            }
          }
        } else {
          couponRow = null;
        }
      }

      const finalAmountCents = Math.max(0, priceRow.priceCents - discountCents);
      const durationDays = DURATION_DAYS[priceRow.duration] ?? 30;
      const now = new Date();
      const periodEnd = new Date(now.getTime() + durationDays * 86400 * 1000);
      const invoicePrefix = s.billing_invoice_prefix ?? "INV-";
      const invoiceNumber = `${invoicePrefix}${now.toISOString().slice(0, 10).replace(/-/g, "")}${randomBytes(4).toString("hex")}`;

      const subscriptionId = randomUUID();
      const invoiceId = randomUUID();
      const invoiceItemId = randomUUID();
      const walletTxId = randomUUID();
      const transactionId = randomUUID();
      const serverId = randomUUID();
      const serverUuid = randomUUID();
      const serverUuidShort = serverUuid.slice(0, 8);

      const resolveVar = (v: { envVariable: string; userEditable: boolean; defaultValue: string | null }) =>
        v.userEditable && input.envVars && v.envVariable in input.envVars
          ? (input.envVars[v.envVariable] ?? "")
          : (v.defaultValue ?? "");

      const varMap: Record<string, string> = {};
      for (const v of eggRow.variables) {
        varMap[v.envVariable] = resolveVar(v);
      }
      const serverInvocation = buildInvocation(eggRow.startup, varMap);
      let dockerImages: Record<string, string> = {};
      try { dockerImages = JSON.parse(eggRow.dockerImages as unknown as string) as Record<string, string>; } catch {}
      const availableImages = Object.values(dockerImages);
      const serverImage = (input.dockerImage && availableImages.includes(input.dockerImage))
        ? input.dockerImage
        : availableImages[0] ?? "";

      if (finalAmountCents > 0 && (wallet?.balanceCents ?? 0) < finalAmountCents) {
        throw new ORPCError("BAD_REQUEST", { data: { code: "INSUFFICIENT_FUNDS" } });
      }

      await db.transaction(async (tx) => {
        let balanceAfter = (wallet?.balanceCents ?? 0) - finalAmountCents;

        if (finalAmountCents > 0) {
          const result = await tx
            .update(billingWallet)
            .set({ balanceCents: sql`${billingWallet.balanceCents} - ${finalAmountCents}` })
            .where(and(
              eq(billingWallet.userId, userId),
              gte(billingWallet.balanceCents, finalAmountCents),
            ));
          if ((result as unknown as [{ affectedRows: number }])[0].affectedRows !== 1) {
            throw new ORPCError("BAD_REQUEST", { data: { code: "INSUFFICIENT_FUNDS" } });
          }
          const refreshed = await tx.query.billingWallet.findFirst({
            where: eq(billingWallet.userId, userId),
            columns: { balanceCents: true },
          });
          balanceAfter = refreshed?.balanceCents ?? balanceAfter;
        }

        await tx.insert(billingSubscriptions).values({
          id: subscriptionId,
          userId,
          planId: plan.id,
          priceId: priceRow.id,
          status: "active",
          currency,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        });

        await tx.insert(servers).values({
          id: serverId,
          uuid: serverUuid,
          uuidShort: serverUuidShort,
          name: input.serverName,
          userId,
          nodeId: alloc.nodeId,
          eggId: input.eggId,
          allocationId: alloc.id,
          subscriptionId,
          memory: (planLimits?.ram ?? 0.5) * 1024,
          disk: (planLimits?.disk ?? 1) * 1024,
          cpu: (planLimits?.cpu ?? 1) * 100,
          swap: 0,
          io: 500,
          oomDisabled: false,
          image: serverImage,
          startup: eggRow.startup,
          invocation: serverInvocation,
          status: "installing",
        });

        if (eggRow.variables.length > 0) {
          await tx.insert(serverVariables).values(
            eggRow.variables.map((v) => ({
              id: randomUUID(),
              serverId,
              variableId: v.id,
              variableValue: resolveVar(v),
            })),
          );
        }

        await tx.update(nodeAllocations).set({ serverId }).where(eq(nodeAllocations.id, alloc.id));

        await tx.insert(billingInvoices).values({
          id: invoiceId,
          userId,
          subscriptionId,
          invoiceNumber,
          status: "paid",
          currency,
          subtotalCents: priceRow.priceCents,
          discountCents,
          totalCents: finalAmountCents,
          amountPaidCents: finalAmountCents,
          amountDueCents: 0,
          paidAt: now,
        });

        await tx.insert(billingInvoiceItems).values({
          id: invoiceItemId,
          invoiceId,
          description: `${plan.name} — ${priceRow.duration}`,
          quantity: 1,
          unitAmountCents: priceRow.priceCents,
          totalCents: priceRow.priceCents,
          currency,
          periodStart: now,
          periodEnd,
        });

        if (finalAmountCents > 0) {
          await tx.insert(billingWalletTransactions).values({
            id: walletTxId,
            userId,
            invoiceId,
            amountCents: -finalAmountCents,
            balanceAfterCents: balanceAfter,
            currency,
            type: "charge",
            description: `${plan.name} — ${priceRow.duration}`,
          });

          await tx.insert(billingTransactions).values({
            id: transactionId,
            userId,
            invoiceId,
            type: "payment",
            status: "succeeded",
            amountCents: finalAmountCents,
            currency,
            description: `${plan.name} — ${priceRow.duration}`,
          });
        }

        if (couponRow && discountCents > 0) {
          await tx.insert(billingCouponRedemptions).values({
            id: randomUUID(),
            couponId: couponRow.id,
            userId,
            invoiceId,
            discountAmountCents: discountCents,
            currency,
          });
          await tx
            .update(billingCoupons)
            .set({ timesRedeemed: couponRow.timesRedeemed + 1 })
            .where(eq(billingCoupons.id, couponRow.id));
        }
      });

      const wingsNode = alloc.node as typeof nodes.$inferSelect;
      const wingsClient = createWingsClient(wingsNode);
      const environment: Record<string, string> = {};
      for (const v of eggRow.variables) {
        environment[v.envVariable] = resolveVar(v);
      }
      try {
        await wingsClient.createServer({
          uuid: serverUuid,
          start_on_completion: true,
          environment,
          limits: {
            cpu: (planLimits?.cpu ?? 1) * 100,
            memory: (planLimits?.ram ?? 0.5) * 1024,
            disk: (planLimits?.disk ?? 1) * 1024,
            swap: 0,
            io: 500,
            threads: null,
            oom_disabled: false,
          },
          container: {
            image: serverImage,
            oom_killer: true,
          },
        });
      } catch {
        // Wings provisioning failed; server stays "installing" — admin can reinstall
      }

      invalidateCapacityCache();

      recordActivity({
        eventType: "billing.plan.purchase",
        userId,
        ip: context.ip,
        properties: { planId: plan.id, priceId: priceRow.id, amountCents: finalAmountCents, serverId },
      });

      return { subscriptionId, invoiceId, serverId, serverUuid };
    }),

  getServerSubscription: protectedProcedure
    .input(z.object({ serverId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const server = await db.query.servers.findFirst({
        where: eq(servers.uuid, input.serverId),
        columns: { subscriptionId: true, userId: true },
      });
      if (!server || server.userId !== context.session.user.id) throw new ORPCError("NOT_FOUND");
      if (!server.subscriptionId) throw new ORPCError("NOT_FOUND");

      const sub = await db.query.billingSubscriptions.findFirst({
        where: eq(billingSubscriptions.id, server.subscriptionId),
        with: {
          plan: { columns: { id: true, name: true } },
          price: { columns: { priceCents: true, duration: true } },
        },
      });
      if (!sub) throw new ORPCError("NOT_FOUND");

      const availablePrices = await db.query.billingPlanPrices.findMany({
        where: and(
          eq(billingPlanPrices.planId, sub.planId),
          eq(billingPlanPrices.isActive, true),
        ),
        columns: { id: true, duration: true, priceCents: true },
        orderBy: [asc(billingPlanPrices.priceCents)],
      });

      return {
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        planName: sub.plan?.name ?? "",
        currency: sub.currency,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        availablePrices: availablePrices.map((p) => ({
          id: p.id,
          duration: p.duration,
          priceCents: p.priceCents,
        })),
      };
    }),

  extendSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid(), priceId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const sub = await db.query.billingSubscriptions.findFirst({
        where: and(
          eq(billingSubscriptions.id, input.subscriptionId),
          eq(billingSubscriptions.userId, userId),
        ),
        with: { plan: { columns: { name: true } } },
      });
      if (!sub) throw new ORPCError("NOT_FOUND");
      if (!["active", "trialing", "past_due"].includes(sub.status)) {
        throw new ORPCError("BAD_REQUEST", { message: "Subscription cannot be extended" });
      }

      const priceRow = await db.query.billingPlanPrices.findFirst({
        where: and(
          eq(billingPlanPrices.id, input.priceId),
          eq(billingPlanPrices.planId, sub.planId),
          eq(billingPlanPrices.isActive, true),
        ),
      });
      if (!priceRow) throw new ORPCError("NOT_FOUND", { message: "Price not found for this plan" });

      const durationDays = DURATION_DAYS[priceRow.duration] ?? 30;
      const planName = sub.plan?.name ?? "";
      const txDescription = `${planName} — extension:${priceRow.duration}`;
      const priceCents = priceRow.priceCents;
      const currency = sub.currency;

      const wallet = await db.query.billingWallet.findFirst({
        where: eq(billingWallet.userId, userId),
      });
      if ((wallet?.balanceCents ?? 0) < priceCents) {
        throw new ORPCError("BAD_REQUEST", { data: { code: "INSUFFICIENT_FUNDS" } });
      }

      const invoiceId = randomUUID();
      const invoiceItemId = randomUUID();
      const walletTxId = randomUUID();
      const transactionId = randomUUID();
      const now = new Date();

      const invoiceNumber = `INV-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

      let newPeriodEnd: Date = new Date((sub.currentPeriodEnd ?? now).getTime() + durationDays * 86400 * 1000);

      await db.transaction(async (tx) => {
        let balanceAfter = (wallet?.balanceCents ?? 0) - priceCents;

        if (priceCents > 0) {
          const result = await tx
            .update(billingWallet)
            .set({ balanceCents: sql`${billingWallet.balanceCents} - ${priceCents}` })
            .where(and(
              eq(billingWallet.userId, userId),
              gte(billingWallet.balanceCents, priceCents),
            ));
          if ((result as unknown as [{ affectedRows: number }])[0].affectedRows !== 1) {
            throw new ORPCError("BAD_REQUEST", { data: { code: "INSUFFICIENT_FUNDS" } });
          }
          const refreshed = await tx.query.billingWallet.findFirst({
            where: eq(billingWallet.userId, userId),
            columns: { balanceCents: true },
          });
          balanceAfter = refreshed?.balanceCents ?? balanceAfter;
        }

        await tx
          .update(billingSubscriptions)
          .set({
            currentPeriodEnd: sql`DATE_ADD(COALESCE(${billingSubscriptions.currentPeriodEnd}, NOW()), INTERVAL ${durationDays} DAY)`,
            cancelAtPeriodEnd: false,
            canceledAt: null,
          })
          .where(eq(billingSubscriptions.id, sub.id));

        const updatedSub = await tx.query.billingSubscriptions.findFirst({
          where: eq(billingSubscriptions.id, sub.id),
          columns: { currentPeriodEnd: true },
        });
        newPeriodEnd = updatedSub?.currentPeriodEnd ?? newPeriodEnd;

        await tx.insert(billingInvoices).values({
          id: invoiceId,
          userId,
          subscriptionId: sub.id,
          invoiceNumber,
          status: "paid",
          currency,
          subtotalCents: priceCents,
          discountCents: 0,
          totalCents: priceCents,
          amountPaidCents: priceCents,
          amountDueCents: 0,
          paidAt: now,
        });

        await tx.insert(billingInvoiceItems).values({
          id: invoiceItemId,
          invoiceId,
          description: txDescription,
          quantity: 1,
          unitAmountCents: priceCents,
          totalCents: priceCents,
          currency,
          periodStart: sub.currentPeriodEnd ?? now,
          periodEnd: newPeriodEnd,
        });

        if (priceCents > 0) {
          await tx.insert(billingWalletTransactions).values({
            id: walletTxId,
            userId,
            invoiceId,
            amountCents: -priceCents,
            balanceAfterCents: balanceAfter,
            currency,
            type: "charge",
            description: txDescription,
          });

          await tx.insert(billingTransactions).values({
            id: transactionId,
            userId,
            invoiceId,
            type: "payment",
            status: "succeeded",
            amountCents: priceCents,
            currency,
            description: txDescription,
          });
        }
      });

      recordActivity({
        eventType: "billing.subscription.extend",
        userId,
        ip: context.ip,
        properties: { subscriptionId: sub.id, priceId: priceRow.id, amountCents: priceCents, newPeriodEnd },
      });

      return { newPeriodEnd };
    }),

  cancelSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const sub = await db.query.billingSubscriptions.findFirst({
        where: and(
          eq(billingSubscriptions.id, input.subscriptionId),
          eq(billingSubscriptions.userId, context.session.user.id),
        ),
      });
      if (!sub) throw new ORPCError("NOT_FOUND");
      await db
        .update(billingSubscriptions)
        .set({ cancelAtPeriodEnd: true, canceledAt: new Date() })
        .where(eq(billingSubscriptions.id, sub.id));
      recordActivity({
        eventType: "billing.subscription.cancel",
        userId: context.session.user.id,
        ip: context.ip,
        properties: { subscriptionId: sub.id },
      });
    }),

  adminGetUserWallet: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input }) => {
      const row = await db.query.billingWallet.findFirst({
        where: eq(billingWallet.userId, input.userId),
      });
      if (!row) {
        const currencyRow = await db.query.settings.findFirst({
          where: eq(settings.key, "billing_default_currency"),
        });
        return { balanceCents: 0, currency: currencyRow?.value ?? "USD" };
      }
      return { balanceCents: row.balanceCents, currency: row.currency };
    }),

  adminListUserSubscriptions: adminProcedure
    .input(z.object({ userId: z.string() }))
    .handler(async ({ input }) => {
      const rows = await db.query.billingSubscriptions.findMany({
        where: eq(billingSubscriptions.userId, input.userId),
        orderBy: [desc(billingSubscriptions.createdAt)],
        with: {
          plan: { with: { product: { columns: { name: true } } }, columns: { name: true } },
          price: { columns: { priceCents: true, duration: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        planName: r.plan?.name ?? "",
        productName: r.plan?.product?.name ?? "",
        priceCents: r.price?.priceCents ?? 0,
        duration: r.price?.duration ?? "",
        currency: r.currency,
        currentPeriodStart: r.currentPeriodStart,
        currentPeriodEnd: r.currentPeriodEnd,
        cancelAtPeriodEnd: r.cancelAtPeriodEnd,
        canceledAt: r.canceledAt,
        createdAt: r.createdAt,
      }));
    }),

  adminListUserWalletTransactions: adminProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    }))
    .handler(async ({ input }) => {
      const rows = await db.query.billingWalletTransactions.findMany({
        where: eq(billingWalletTransactions.userId, input.userId),
        orderBy: [desc(billingWalletTransactions.createdAt)],
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        amountCents: r.amountCents,
        balanceAfterCents: r.balanceAfterCents,
        currency: r.currency,
        description: r.description,
        createdAt: r.createdAt,
      }));
    }),

  adminAdjustUserBalance: adminProcedure
    .input(z.object({
      userId: z.string(),
      amountCents: z.number().int(),
      description: z.string().optional(),
    }))
    .handler(async ({ context, input }) => {
      const settingsRows = await db.select().from(settings);
      const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value ?? ""]));
      const defaultCurrency = s.billing_default_currency || "USD";

      let newBalanceCents = 0;
      await db.transaction(async (tx) => {
        let wallet = await tx.query.billingWallet.findFirst({
          where: eq(billingWallet.userId, input.userId),
        });
        if (!wallet) {
          const walletId = randomUUID();
          await tx.insert(billingWallet).values({
            id: walletId,
            userId: input.userId,
            balanceCents: 0,
            currency: defaultCurrency,
          });
          wallet = await tx.query.billingWallet.findFirst({
            where: eq(billingWallet.userId, input.userId),
          });
        }
        await tx
          .update(billingWallet)
          .set({ balanceCents: sql`${billingWallet.balanceCents} + ${input.amountCents}` })
          .where(eq(billingWallet.userId, input.userId));
        const refreshed = await tx.query.billingWallet.findFirst({
          where: eq(billingWallet.userId, input.userId),
          columns: { balanceCents: true },
        });
        const balanceAfter = refreshed?.balanceCents ?? (wallet!.balanceCents + input.amountCents);
        await tx.insert(billingWalletTransactions).values({
          id: randomUUID(),
          userId: input.userId,
          amountCents: input.amountCents,
          balanceAfterCents: balanceAfter,
          currency: wallet!.currency,
          type: "adjustment",
          description: input.description ?? null,
        });
        newBalanceCents = balanceAfter;
      });

      recordActivity({
        eventType: "admin:billing.wallet.adjust",
        userId: context.session.user.id,
        ip: context.ip,
        properties: { targetUserId: input.userId, amountCents: input.amountCents },
      });

      return { newBalanceCents };
    }),
};
