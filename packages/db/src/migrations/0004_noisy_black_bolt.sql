CREATE TABLE `billing_categories` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`slug` varchar(255) NOT NULL,
	`icon` text,
	`cover_image` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `billing_coupon_redemptions` (
	`id` varchar(36) NOT NULL,
	`coupon_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`invoice_id` varchar(36),
	`discount_amount_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`redeemed_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_coupon_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_coupon_redemptions_couponId_userId_unique` UNIQUE(`coupon_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_coupons` (
	`id` varchar(36) NOT NULL,
	`code` varchar(100) NOT NULL,
	`description` text,
	`discount_type` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`discount_value` int NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`max_redemptions` int,
	`times_redeemed` int NOT NULL DEFAULT 0,
	`redeem_by` timestamp(3),
	`is_active` boolean NOT NULL DEFAULT true,
	`plan_id` varchar(36),
	`provider_coupon_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `billing_invoice_items` (
	`id` varchar(36) NOT NULL,
	`invoice_id` varchar(36) NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_amount_cents` int NOT NULL,
	`total_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`period_start` timestamp(3),
	`period_end` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_invoices` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`subscription_id` varchar(36),
	`gateway_id` varchar(36),
	`invoice_number` varchar(100) NOT NULL,
	`status` enum('draft','open','paid','uncollectible','void') NOT NULL DEFAULT 'draft',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`subtotal_cents` int NOT NULL DEFAULT 0,
	`tax_cents` int NOT NULL DEFAULT 0,
	`discount_cents` int NOT NULL DEFAULT 0,
	`total_cents` int NOT NULL DEFAULT 0,
	`amount_paid_cents` int NOT NULL DEFAULT 0,
	`amount_due_cents` int NOT NULL DEFAULT 0,
	`vat_number` varchar(50),
	`vat_rate` int,
	`billing_address` json,
	`due_date` timestamp(3),
	`paid_at` timestamp(3),
	`notes` text,
	`provider_invoice_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_invoices_invoiceNumber_unique` UNIQUE(`invoice_number`)
);
--> statement-breakpoint
CREATE TABLE `billing_payment_gateways` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`provider` varchar(100) NOT NULL,
	`config` json NOT NULL DEFAULT ('{}'),
	`is_active` boolean NOT NULL DEFAULT false,
	`is_default` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_payment_gateways_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_payment_methods` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`gateway_id` varchar(36),
	`type` enum('card','sepa_debit','paypal','bank_transfer','other') NOT NULL DEFAULT 'card',
	`card_brand` varchar(50),
	`card_last4` varchar(4),
	`card_exp_month` int,
	`card_exp_year` int,
	`is_default` boolean NOT NULL DEFAULT false,
	`provider_payment_method_id` varchar(255) NOT NULL,
	`provider_customer_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_plan_prices` (
	`id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`duration` enum('7day','1month','3months','6months','1year') NOT NULL,
	`price_cents` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`provider_price_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_plan_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_plan_prices_planId_duration_unique` UNIQUE(`plan_id`,`duration`)
);
--> statement-breakpoint
CREATE TABLE `billing_plans` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`resource_limits` json NOT NULL DEFAULT ('{}'),
	`is_active` boolean NOT NULL DEFAULT true,
	`is_public` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`provider_plan_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_products` (
	`id` varchar(36) NOT NULL,
	`category_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text,
	`slug` varchar(255) NOT NULL,
	`icon` text,
	`cover_image` text,
	`inherit_icon` boolean NOT NULL DEFAULT false,
	`inherit_cover_image` boolean NOT NULL DEFAULT false,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `billing_referral_codes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`usage_count` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_referral_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_referral_codes_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `billing_referral_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `billing_referral_redemptions` (
	`id` varchar(36) NOT NULL,
	`code_id` varchar(36) NOT NULL,
	`referee_id` varchar(36) NOT NULL,
	`referrer_id` varchar(36) NOT NULL,
	`first_topup_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_referral_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_referral_redemptions_referee_id_unique` UNIQUE(`referee_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`gateway_id` varchar(36),
	`price_id` varchar(36) NOT NULL,
	`status` enum('active','trialing','past_due','canceled','unpaid','paused') NOT NULL DEFAULT 'active',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`current_period_start` timestamp(3) NOT NULL,
	`current_period_end` timestamp(3) NOT NULL,
	`trial_start` timestamp(3),
	`trial_end` timestamp(3),
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`canceled_at` timestamp(3),
	`provider_subscription_id` varchar(255),
	`provider_customer_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_transactions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`invoice_id` varchar(36),
	`payment_method_id` varchar(36),
	`gateway_id` varchar(36),
	`type` enum('payment','refund','chargeback','adjustment') NOT NULL DEFAULT 'payment',
	`status` enum('pending','succeeded','failed','canceled','refunded') NOT NULL DEFAULT 'pending',
	`amount_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`description` text,
	`failure_message` text,
	`provider_transaction_id` varchar(255) UNIQUE,
	`provider_charge_id` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_wallet` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`balance_cents` int NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`auto_top_up_enabled` boolean NOT NULL DEFAULT false,
	`auto_top_up_threshold_cents` int NOT NULL DEFAULT 0,
	`auto_top_up_amount_cents` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_wallet_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_wallet_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `billing_wallet_transactions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`invoice_id` varchar(36),
	`amount_cents` int NOT NULL,
	`balance_after_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`type` enum('topup','refund','charge','adjustment','expired') NOT NULL,
	`description` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_wallet_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `servers` ADD `subscription_id` varchar(36);--> statement-breakpoint
ALTER TABLE `billing_coupon_redemptions` ADD CONSTRAINT `billing_coupon_redemptions_coupon_id_billing_coupons_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `billing_coupons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_coupon_redemptions` ADD CONSTRAINT `billing_coupon_redemptions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_coupon_redemptions` ADD CONSTRAINT `billing_coupon_redemptions_invoice_id_billing_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `billing_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_coupons` ADD CONSTRAINT `billing_coupons_plan_id_billing_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_invoice_items` ADD CONSTRAINT `billing_invoice_items_invoice_id_billing_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `billing_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_subscription_id_billing_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `billing_subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_gateway_id_billing_payment_gateways_id_fk` FOREIGN KEY (`gateway_id`) REFERENCES `billing_payment_gateways`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_payment_methods` ADD CONSTRAINT `billing_payment_methods_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_payment_methods` ADD CONSTRAINT `bpm_gateway_id_fk` FOREIGN KEY (`gateway_id`) REFERENCES `billing_payment_gateways`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_plan_prices` ADD CONSTRAINT `billing_plan_prices_plan_id_billing_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_plans` ADD CONSTRAINT `billing_plans_product_id_billing_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `billing_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_products` ADD CONSTRAINT `billing_products_category_id_billing_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `billing_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_referral_codes` ADD CONSTRAINT `billing_referral_codes_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_referral_redemptions` ADD CONSTRAINT `brr_code_id_fk` FOREIGN KEY (`code_id`) REFERENCES `billing_referral_codes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_referral_redemptions` ADD CONSTRAINT `brr_referee_id_fk` FOREIGN KEY (`referee_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_referral_redemptions` ADD CONSTRAINT `brr_referrer_id_fk` FOREIGN KEY (`referrer_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_plan_id_billing_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_gateway_id_billing_payment_gateways_id_fk` FOREIGN KEY (`gateway_id`) REFERENCES `billing_payment_gateways`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD CONSTRAINT `billing_subscriptions_price_id_billing_plan_prices_id_fk` FOREIGN KEY (`price_id`) REFERENCES `billing_plan_prices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_transactions` ADD CONSTRAINT `billing_transactions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_transactions` ADD CONSTRAINT `billing_transactions_invoice_id_billing_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `billing_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_transactions` ADD CONSTRAINT `billing_transactions_gateway_id_billing_payment_gateways_id_fk` FOREIGN KEY (`gateway_id`) REFERENCES `billing_payment_gateways`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_transactions` ADD CONSTRAINT `bt_payment_method_id_fk` FOREIGN KEY (`payment_method_id`) REFERENCES `billing_payment_methods`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_wallet` ADD CONSTRAINT `billing_wallet_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_wallet_transactions` ADD CONSTRAINT `billing_wallet_transactions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_wallet_transactions` ADD CONSTRAINT `billing_wallet_transactions_invoice_id_billing_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `billing_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `billing_coupon_redemptions_couponId_idx` ON `billing_coupon_redemptions` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `billing_coupon_redemptions_userId_idx` ON `billing_coupon_redemptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_coupon_redemptions_invoiceId_idx` ON `billing_coupon_redemptions` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `billing_coupons_planId_idx` ON `billing_coupons` (`plan_id`);--> statement-breakpoint
CREATE INDEX `billing_invoice_items_invoiceId_idx` ON `billing_invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `billing_invoices_userId_idx` ON `billing_invoices` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_invoices_subscriptionId_idx` ON `billing_invoices` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `billing_invoices_providerInvoiceId_idx` ON `billing_invoices` (`provider_invoice_id`);--> statement-breakpoint
CREATE INDEX `billing_payment_methods_userId_idx` ON `billing_payment_methods` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_payment_methods_providerPaymentMethodId_idx` ON `billing_payment_methods` (`provider_payment_method_id`);--> statement-breakpoint
CREATE INDEX `billing_plan_prices_planId_idx` ON `billing_plan_prices` (`plan_id`);--> statement-breakpoint
CREATE INDEX `billing_plans_productId_idx` ON `billing_plans` (`product_id`);--> statement-breakpoint
CREATE INDEX `billing_products_categoryId_idx` ON `billing_products` (`category_id`);--> statement-breakpoint
CREATE INDEX `brr_code_id_idx` ON `billing_referral_redemptions` (`code_id`);--> statement-breakpoint
CREATE INDEX `brr_referrer_id_idx` ON `billing_referral_redemptions` (`referrer_id`);--> statement-breakpoint
CREATE INDEX `billing_subscriptions_userId_idx` ON `billing_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_subscriptions_planId_idx` ON `billing_subscriptions` (`plan_id`);--> statement-breakpoint
CREATE INDEX `billing_subscriptions_providerSubscriptionId_idx` ON `billing_subscriptions` (`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `billing_transactions_userId_idx` ON `billing_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_transactions_invoiceId_idx` ON `billing_transactions` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `billing_transactions_providerTransactionId_idx` ON `billing_transactions` (`provider_transaction_id`);--> statement-breakpoint
CREATE INDEX `billing_wallet_transactions_userId_idx` ON `billing_wallet_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `billing_wallet_transactions_invoiceId_idx` ON `billing_wallet_transactions` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `servers_subscriptionId_idx` ON `servers` (`subscription_id`);