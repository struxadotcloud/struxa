import { randomUUID } from "crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { db } from "@struxa/db";
import {
  billingCategories,
  billingPaymentGateways,
  billingPlans,
  billingPlanPrices,
  billingProducts,
  billingReferralCodes,
  billingReferralRedemptions,
  billingWallet,
  billingWalletTransactions,
  settings,
} from "@struxa/db";
import { recordActivity } from "../services/activity";
import { encrypt, decrypt } from "../lib/crypto";
import { createStripeTopupSession, createSimPayTopupSession } from "@struxa/payments";
import { adminProcedure, protectedProcedure } from "../index";

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const DURATIONS = ["7day", "1month", "3months", "6months", "1year"] as const;

const resourceLimitsSchema = z.object({
  cpu: z.number().min(0),
  ram: z.number().min(0),
  disk: z.number().min(0),
  backups: z.number().int().min(0),
  allocations: z.number().int().min(0),
  databases: z.number().int().min(0),
  eggs: z.array(z.string()),
});

export const billingRouter = {
  getConfig: protectedProcedure.handler(async () => {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    return {
      enabled: s.billing_enabled !== "false",
      referralEnabled: s.billing_referral_enabled === "true",
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
      const products = await db.query.billingProducts.findMany({
        where: input?.categoryId
          ? and(eq(billingProducts.isActive, true), eq(billingProducts.categoryId, input.categoryId))
          : eq(billingProducts.isActive, true),
        orderBy: [asc(billingProducts.sortOrder)],
        with: {
          plans: {
            where: and(eq(billingPlans.isActive, true), eq(billingPlans.isPublic, true)),
            with: {
              prices: { where: eq(billingPlanPrices.isActive, true) },
            },
          },
        },
      });
      return products
        .filter((p) => p.plans.length > 0)
        .map((product) => {
          const plan = product.plans[0]!;
          const limits = plan.resourceLimits as {
            cpu?: number; ram?: number; disk?: number;
            backups?: number; allocations?: number; databases?: number; eggs?: string[];
          } | null;
          return {
            id: product.id,
            categoryId: product.categoryId ?? "",
            name: product.name,
            description: product.description ?? "",
            isFeatured: product.isFeatured,
            icon: product.icon ?? "",
            currency: plan.currency,
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
        publishableKey?: string; secretKey?: string; serviceId?: string;
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
        backups?: number; allocations?: number; databases?: number; eggs?: string[];
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
      if (input.isFeatured && input.categoryId) {
        await db
          .update(billingProducts)
          .set({ isFeatured: false })
          .where(eq(billingProducts.categoryId, input.categoryId));
      }

      const productId = randomUUID();
      const planId = randomUUID();
      const slug = input.slug || slugify(input.name);

      await db.insert(billingProducts).values({
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

      await db.insert(billingPlans).values({
        id: planId,
        productId,
        name: input.name,
        description: input.description,
        currency: input.currency ?? "USD",
        resourceLimits: input.resourceLimits,
        isActive: input.isActive ?? true,
        isPublic: input.isPublic ?? true,
        sortOrder: 0,
      });

      if (input.prices.length > 0) {
        await db.insert(billingPlanPrices).values(
          input.prices.map((p) => ({
            id: randomUUID(),
            planId,
            duration: p.duration,
            priceCents: p.priceCents,
            isActive: true,
          })),
        );
      }

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
          await db.delete(billingPlanPrices).where(eq(billingPlanPrices.planId, existingPlan.id));
          if (input.prices.length > 0) {
            await db.insert(billingPlanPrices).values(
              input.prices.map((p) => ({
                id: randomUUID(),
                planId: existingPlan.id,
                duration: p.duration,
                priceCents: p.priceCents,
                isActive: true,
              })),
            );
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
      const config = r.config as { publishableKey?: string; secretKey?: string; webhookSecret?: string } | null ?? {};
      return {
        id: r.id,
        name: r.name,
        provider: r.provider,
        isActive: r.isActive,
        sortOrder: r.sortOrder,
        hasPublishableKey: !!config.publishableKey,
        hasSecretKey: !!config.secretKey,
        hasWebhookSecret: !!config.webhookSecret,
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
      }),
    )
    .handler(async ({ context, input }) => {
      const id = randomUUID();
      const config: Record<string, string> = {};
      if (input.publishableKey) config.publishableKey = input.publishableKey;
      if (input.secretKey) config.secretKey = encrypt(input.secretKey);
      if (input.webhookSecret) config.webhookSecret = encrypt(input.webhookSecret);
      if (input.serviceId) config.serviceId = input.serviceId;
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
        .set({ usageCount: referralCode.usageCount + 1 })
        .where(eq(billingReferralCodes.id, referralCode.id));

      return { success: true };
    }),
};
