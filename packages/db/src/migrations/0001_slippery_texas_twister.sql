CREATE TABLE `settings` (
	`key` varchar(255) NOT NULL,
	`value` text,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
