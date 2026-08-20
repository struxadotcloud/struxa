CREATE TABLE `user_google_drives` (
	`user_id` varchar(36) NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`email` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_google_drives_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `backups` ADD `drive_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `backups` ADD `remote_file_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user_google_drives` ADD CONSTRAINT `user_google_drives_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;