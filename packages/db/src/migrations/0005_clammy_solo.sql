DROP INDEX `billing_transactions_providerTransactionId_idx` ON `billing_transactions`;--> statement-breakpoint
ALTER TABLE `server_databases` MODIFY COLUMN `remote` varchar(15);--> statement-breakpoint
ALTER TABLE `database_hosts` ADD `type` enum('mysql','mariadb','postgresql','mongodb','redis') DEFAULT 'mysql' NOT NULL;--> statement-breakpoint
ALTER TABLE `eggs` ADD `allowed_database_types` text;--> statement-breakpoint
ALTER TABLE `billing_transactions` ADD CONSTRAINT `billing_transactions_providerTransactionId_unique` UNIQUE(`provider_transaction_id`);