CREATE TABLE `ext_migrations` (
	`id` varchar(36) NOT NULL,
	`ext_id` varchar(64) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`applied_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `ext_migrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extensions` (
	`id` varchar(64) NOT NULL,
	`version` varchar(32) NOT NULL,
	`source_url` varchar(1024),
	`manifest` json NOT NULL,
	`granted_permissions` json NOT NULL DEFAULT ('[]'),
	`enabled` boolean NOT NULL DEFAULT false,
	`status` varchar(20) NOT NULL DEFAULT 'installed',
	`last_error` varchar(2048),
	`installed_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `extensions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `nodes` ADD `metadata` json;--> statement-breakpoint
ALTER TABLE `servers` ADD `metadata` json;--> statement-breakpoint
CREATE UNIQUE INDEX `ext_migrations_extId_hash_idx` ON `ext_migrations` (`ext_id`,`hash`);