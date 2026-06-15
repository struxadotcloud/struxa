import { relations } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";
import { user } from "./auth";

export const billingCategories = mysqlTable("billing_categories", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  icon: text("icon"),
  coverImage: text("cover_image"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const billingProducts = mysqlTable(
  "billing_products",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    categoryId: varchar("category_id", { length: 36 }).references(
      () => billingCategories.id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    icon: text("icon"),
    coverImage: text("cover_image"),
    inheritIcon: boolean("inherit_icon").notNull().default(false),
    inheritCoverImage: boolean("inherit_cover_image").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("billing_products_categoryId_idx").on(table.categoryId)],
);

export const billingPaymentGateways = mysqlTable("billing_payment_gateways", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  config: json("config").notNull().default({}),
  isActive: boolean("is_active").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const billingPlans = mysqlTable(
  "billing_plans",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    productId: varchar("product_id", { length: 36 }).references(
      () => billingProducts.id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    resourceLimits: json("resource_limits").notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    providerPlanId: varchar("provider_plan_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("billing_plans_productId_idx").on(table.productId)],
);

export const billingPlanPrices = mysqlTable(
  "billing_plan_prices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    planId: varchar("plan_id", { length: 36 })
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
    duration: mysqlEnum("duration", [
      "7day",
      "1month",
      "3months",
      "6months",
      "1year",
    ]).notNull(),
    priceCents: int("price_cents").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    providerPriceId: varchar("provider_price_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_plan_prices_planId_idx").on(table.planId),
    unique("billing_plan_prices_planId_duration_unique").on(
      table.planId,
      table.duration,
    ),
  ],
);

export const billingSubscriptions = mysqlTable(
  "billing_subscriptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    planId: varchar("plan_id", { length: 36 })
      .notNull()
      .references(() => billingPlans.id),
    gatewayId: varchar("gateway_id", { length: 36 }).references(
      () => billingPaymentGateways.id,
    ),
    priceId: varchar("price_id", { length: 36 })
      .notNull()
      .references(() => billingPlanPrices.id),
    status: mysqlEnum("status", [
      "active",
      "trialing",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ])
      .notNull()
      .default("active"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    currentPeriodStart: timestamp("current_period_start", { fsp: 3 }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", { fsp: 3 }).notNull(),
    trialStart: timestamp("trial_start", { fsp: 3 }),
    trialEnd: timestamp("trial_end", { fsp: 3 }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { fsp: 3 }),
    providerSubscriptionId: varchar("provider_subscription_id", {
      length: 255,
    }),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_subscriptions_userId_idx").on(table.userId),
    index("billing_subscriptions_planId_idx").on(table.planId),
    index("billing_subscriptions_providerSubscriptionId_idx").on(
      table.providerSubscriptionId,
    ),
  ],
);

export const billingInvoices = mysqlTable(
  "billing_invoices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    subscriptionId: varchar("subscription_id", { length: 36 }).references(
      () => billingSubscriptions.id,
    ),
    gatewayId: varchar("gateway_id", { length: 36 }).references(
      () => billingPaymentGateways.id,
    ),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    status: mysqlEnum("status", [
      "draft",
      "open",
      "paid",
      "uncollectible",
      "void",
    ])
      .notNull()
      .default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    subtotalCents: int("subtotal_cents").notNull().default(0),
    taxCents: int("tax_cents").notNull().default(0),
    discountCents: int("discount_cents").notNull().default(0),
    totalCents: int("total_cents").notNull().default(0),
    amountPaidCents: int("amount_paid_cents").notNull().default(0),
    amountDueCents: int("amount_due_cents").notNull().default(0),
    vatNumber: varchar("vat_number", { length: 50 }),
    vatRate: int("vat_rate"),
    billingAddress: json("billing_address"),
    dueDate: timestamp("due_date", { fsp: 3 }),
    paidAt: timestamp("paid_at", { fsp: 3 }),
    notes: text("notes"),
    providerInvoiceId: varchar("provider_invoice_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("billing_invoices_invoiceNumber_unique").on(table.invoiceNumber),
    index("billing_invoices_userId_idx").on(table.userId),
    index("billing_invoices_subscriptionId_idx").on(table.subscriptionId),
    index("billing_invoices_providerInvoiceId_idx").on(table.providerInvoiceId),
  ],
);

export const billingInvoiceItems = mysqlTable(
  "billing_invoice_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    invoiceId: varchar("invoice_id", { length: 36 })
      .notNull()
      .references(() => billingInvoices.id, { onDelete: "cascade" }),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: int("quantity").notNull().default(1),
    unitAmountCents: int("unit_amount_cents").notNull(),
    totalCents: int("total_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    periodStart: timestamp("period_start", { fsp: 3 }),
    periodEnd: timestamp("period_end", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("billing_invoice_items_invoiceId_idx").on(table.invoiceId)],
);

export const billingPaymentMethods = mysqlTable(
  "billing_payment_methods",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gatewayId: varchar("gateway_id", { length: 36 }),
    type: mysqlEnum("type", [
      "card",
      "sepa_debit",
      "paypal",
      "bank_transfer",
      "other",
    ])
      .notNull()
      .default("card"),
    cardBrand: varchar("card_brand", { length: 50 }),
    cardLast4: varchar("card_last4", { length: 4 }),
    cardExpMonth: int("card_exp_month"),
    cardExpYear: int("card_exp_year"),
    isDefault: boolean("is_default").notNull().default(false),
    providerPaymentMethodId: varchar("provider_payment_method_id", {
      length: 255,
    }).notNull(),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_payment_methods_userId_idx").on(table.userId),
    index("billing_payment_methods_providerPaymentMethodId_idx").on(
      table.providerPaymentMethodId,
    ),
    foreignKey({
      name: "bpm_gateway_id_fk",
      columns: [table.gatewayId],
      foreignColumns: [billingPaymentGateways.id],
    }),
  ],
);

export const billingTransactions = mysqlTable(
  "billing_transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    invoiceId: varchar("invoice_id", { length: 36 }).references(
      () => billingInvoices.id,
    ),
    paymentMethodId: varchar("payment_method_id", { length: 36 }),
    gatewayId: varchar("gateway_id", { length: 36 }).references(
      () => billingPaymentGateways.id,
    ),
    type: mysqlEnum("type", ["payment", "refund", "chargeback", "adjustment"])
      .notNull()
      .default("payment"),
    status: mysqlEnum("status", [
      "pending",
      "succeeded",
      "failed",
      "canceled",
      "refunded",
    ])
      .notNull()
      .default("pending"),
    amountCents: int("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    description: text("description"),
    failureMessage: text("failure_message"),
    providerTransactionId: varchar("provider_transaction_id", { length: 255 }),
    providerChargeId: varchar("provider_charge_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_transactions_userId_idx").on(table.userId),
    index("billing_transactions_invoiceId_idx").on(table.invoiceId),
    index("billing_transactions_providerTransactionId_idx").on(
      table.providerTransactionId,
    ),
    foreignKey({
      name: "bt_payment_method_id_fk",
      columns: [table.paymentMethodId],
      foreignColumns: [billingPaymentMethods.id],
    }),
  ],
);

export const billingWallet = mysqlTable("billing_wallet", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => user.id),
  balanceCents: int("balance_cents").notNull().default(0),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(false),
  autoTopUpThresholdCents: int("auto_top_up_threshold_cents")
    .notNull()
    .default(0),
  autoTopUpAmountCents: int("auto_top_up_amount_cents").notNull().default(0),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const billingWalletTransactions = mysqlTable(
  "billing_wallet_transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    invoiceId: varchar("invoice_id", { length: 36 }).references(
      () => billingInvoices.id,
    ),
    amountCents: int("amount_cents").notNull(),
    balanceAfterCents: int("balance_after_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    type: mysqlEnum("type", [
      "topup",
      "refund",
      "charge",
      "adjustment",
      "expired",
    ]).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("billing_wallet_transactions_userId_idx").on(table.userId),
    index("billing_wallet_transactions_invoiceId_idx").on(table.invoiceId),
  ],
);

export const billingCoupons = mysqlTable(
  "billing_coupons",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    code: varchar("code", { length: 100 }).notNull(),
    description: text("description"),
    discountType: mysqlEnum("discount_type", ["percentage", "fixed"])
      .notNull()
      .default("percentage"),
    discountValue: int("discount_value").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD"),
    maxRedemptions: int("max_redemptions"),
    timesRedeemed: int("times_redeemed").notNull().default(0),
    redeemBy: timestamp("redeem_by", { fsp: 3 }),
    isActive: boolean("is_active").notNull().default(true),
    planId: varchar("plan_id", { length: 36 }).references(
      () => billingPlans.id,
    ),
    providerCouponId: varchar("provider_coupon_id", { length: 255 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("billing_coupons_code_unique").on(table.code),
    index("billing_coupons_planId_idx").on(table.planId),
  ],
);

export const billingCouponRedemptions = mysqlTable(
  "billing_coupon_redemptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    couponId: varchar("coupon_id", { length: 36 })
      .notNull()
      .references(() => billingCoupons.id),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id),
    invoiceId: varchar("invoice_id", { length: 36 }).references(
      () => billingInvoices.id,
    ),
    discountAmountCents: int("discount_amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    redeemedAt: timestamp("redeemed_at", { fsp: 3 }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("billing_coupon_redemptions_couponId_userId_unique").on(
      table.couponId,
      table.userId,
    ),
    index("billing_coupon_redemptions_couponId_idx").on(table.couponId),
    index("billing_coupon_redemptions_userId_idx").on(table.userId),
    index("billing_coupon_redemptions_invoiceId_idx").on(table.invoiceId),
  ],
);

export const billingCategoriesRelations = relations(
  billingCategories,
  ({ many }) => ({
    products: many(billingProducts),
  }),
);

export const billingProductsRelations = relations(
  billingProducts,
  ({ one, many }) => ({
    category: one(billingCategories, {
      fields: [billingProducts.categoryId],
      references: [billingCategories.id],
    }),
    plans: many(billingPlans),
  }),
);

export const billingPaymentGatewaysRelations = relations(
  billingPaymentGateways,
  ({ many }) => ({
    subscriptions: many(billingSubscriptions),
    invoices: many(billingInvoices),
    paymentMethods: many(billingPaymentMethods),
    transactions: many(billingTransactions),
  }),
);

export const billingPlansRelations = relations(
  billingPlans,
  ({ one, many }) => ({
    product: one(billingProducts, {
      fields: [billingPlans.productId],
      references: [billingProducts.id],
    }),
    prices: many(billingPlanPrices),
    subscriptions: many(billingSubscriptions),
    coupons: many(billingCoupons),
  }),
);

export const billingPlanPricesRelations = relations(
  billingPlanPrices,
  ({ one, many }) => ({
    plan: one(billingPlans, {
      fields: [billingPlanPrices.planId],
      references: [billingPlans.id],
    }),
    subscriptions: many(billingSubscriptions),
  }),
);

export const billingSubscriptionsRelations = relations(
  billingSubscriptions,
  ({ one, many }) => ({
    user: one(user, {
      fields: [billingSubscriptions.userId],
      references: [user.id],
    }),
    plan: one(billingPlans, {
      fields: [billingSubscriptions.planId],
      references: [billingPlans.id],
    }),
    price: one(billingPlanPrices, {
      fields: [billingSubscriptions.priceId],
      references: [billingPlanPrices.id],
    }),
    gateway: one(billingPaymentGateways, {
      fields: [billingSubscriptions.gatewayId],
      references: [billingPaymentGateways.id],
    }),
    invoices: many(billingInvoices),
  }),
);

export const billingInvoicesRelations = relations(
  billingInvoices,
  ({ one, many }) => ({
    user: one(user, {
      fields: [billingInvoices.userId],
      references: [user.id],
    }),
    subscription: one(billingSubscriptions, {
      fields: [billingInvoices.subscriptionId],
      references: [billingSubscriptions.id],
    }),
    gateway: one(billingPaymentGateways, {
      fields: [billingInvoices.gatewayId],
      references: [billingPaymentGateways.id],
    }),
    items: many(billingInvoiceItems),
    transactions: many(billingTransactions),
    walletTransactions: many(billingWalletTransactions),
    couponRedemptions: many(billingCouponRedemptions),
  }),
);

export const billingInvoiceItemsRelations = relations(
  billingInvoiceItems,
  ({ one }) => ({
    invoice: one(billingInvoices, {
      fields: [billingInvoiceItems.invoiceId],
      references: [billingInvoices.id],
    }),
  }),
);

export const billingPaymentMethodsRelations = relations(
  billingPaymentMethods,
  ({ one, many }) => ({
    user: one(user, {
      fields: [billingPaymentMethods.userId],
      references: [user.id],
    }),
    gateway: one(billingPaymentGateways, {
      fields: [billingPaymentMethods.gatewayId],
      references: [billingPaymentGateways.id],
    }),
    transactions: many(billingTransactions),
  }),
);

export const billingTransactionsRelations = relations(
  billingTransactions,
  ({ one }) => ({
    user: one(user, {
      fields: [billingTransactions.userId],
      references: [user.id],
    }),
    invoice: one(billingInvoices, {
      fields: [billingTransactions.invoiceId],
      references: [billingInvoices.id],
    }),
    paymentMethod: one(billingPaymentMethods, {
      fields: [billingTransactions.paymentMethodId],
      references: [billingPaymentMethods.id],
    }),
    gateway: one(billingPaymentGateways, {
      fields: [billingTransactions.gatewayId],
      references: [billingPaymentGateways.id],
    }),
  }),
);

export const billingWalletRelations = relations(billingWallet, ({ one }) => ({
  user: one(user, {
    fields: [billingWallet.userId],
    references: [user.id],
  }),
}));

export const billingWalletTransactionsRelations = relations(
  billingWalletTransactions,
  ({ one }) => ({
    user: one(user, {
      fields: [billingWalletTransactions.userId],
      references: [user.id],
    }),
    invoice: one(billingInvoices, {
      fields: [billingWalletTransactions.invoiceId],
      references: [billingInvoices.id],
    }),
  }),
);

export const billingCouponsRelations = relations(
  billingCoupons,
  ({ one, many }) => ({
    plan: one(billingPlans, {
      fields: [billingCoupons.planId],
      references: [billingPlans.id],
    }),
    redemptions: many(billingCouponRedemptions),
  }),
);

export const billingReferralCodes = mysqlTable("billing_referral_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull().unique(),
  usageCount: int("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const billingReferralRedemptions = mysqlTable(
  "billing_referral_redemptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    codeId: varchar("code_id", { length: 36 }).notNull(),
    refereeId: varchar("referee_id", { length: 36 }).notNull().unique(),
    referrerId: varchar("referrer_id", { length: 36 }).notNull(),
    firstTopupAt: timestamp("first_topup_at", { fsp: 3 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("brr_code_id_idx").on(table.codeId),
    index("brr_referrer_id_idx").on(table.referrerId),
    foreignKey({ name: "brr_code_id_fk", columns: [table.codeId], foreignColumns: [billingReferralCodes.id] }).onDelete("cascade"),
    foreignKey({ name: "brr_referee_id_fk", columns: [table.refereeId], foreignColumns: [user.id] }).onDelete("cascade"),
    foreignKey({ name: "brr_referrer_id_fk", columns: [table.referrerId], foreignColumns: [user.id] }).onDelete("cascade"),
  ],
);

export const billingReferralCodesRelations = relations(billingReferralCodes, ({ one, many }) => ({
  user: one(user, { fields: [billingReferralCodes.userId], references: [user.id] }),
  redemptions: many(billingReferralRedemptions),
}));

export const billingReferralRedemptionsRelations = relations(billingReferralRedemptions, ({ one }) => ({
  code: one(billingReferralCodes, { fields: [billingReferralRedemptions.codeId], references: [billingReferralCodes.id] }),
  referee: one(user, { fields: [billingReferralRedemptions.refereeId], references: [user.id] }),
  referrer: one(user, { fields: [billingReferralRedemptions.referrerId], references: [user.id] }),
}));

export const billingCouponRedemptionsRelations = relations(
  billingCouponRedemptions,
  ({ one }) => ({
    coupon: one(billingCoupons, {
      fields: [billingCouponRedemptions.couponId],
      references: [billingCoupons.id],
    }),
    user: one(user, {
      fields: [billingCouponRedemptions.userId],
      references: [user.id],
    }),
    invoice: one(billingInvoices, {
      fields: [billingCouponRedemptions.invoiceId],
      references: [billingInvoices.id],
    }),
  }),
);

export const billingUserRelations = relations(user, ({ one, many }) => ({
  billingSubscription: one(billingSubscriptions, {
    fields: [user.id],
    references: [billingSubscriptions.userId],
  }),
  billingWallet: one(billingWallet, {
    fields: [user.id],
    references: [billingWallet.userId],
  }),
  billingInvoices: many(billingInvoices),
  billingPaymentMethods: many(billingPaymentMethods),
  billingTransactions: many(billingTransactions),
  billingWalletTransactions: many(billingWalletTransactions),
  billingCouponRedemptions: many(billingCouponRedemptions),
}));
