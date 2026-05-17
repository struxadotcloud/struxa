CREATE TABLE `activity_logs` (
	`id` varchar(36) NOT NULL,
	`batch_uuid` varchar(36),
	`event_type` varchar(100) NOT NULL,
	`user_id` varchar(36),
	`server_id` varchar(36),
	`node_id` varchar(36),
	`properties` text,
	`ip` varchar(100),
	`hashed_ip` varchar(255),
	`timestamp` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `node_allocations` (
	`id` varchar(36) NOT NULL,
	`node_id` varchar(36) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`ip_alias` varchar(255),
	`port` int NOT NULL,
	`server_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `node_allocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `apikey` (
	`id` varchar(36) NOT NULL,
	`config_id` varchar(64) NOT NULL DEFAULT 'default',
	`name` varchar(255),
	`start` varchar(64),
	`prefix` varchar(64),
	`key` text NOT NULL,
	`reference_id` varchar(36) NOT NULL,
	`refill_interval` int,
	`refill_amount` int,
	`last_refill_at` timestamp(3),
	`enabled` boolean DEFAULT true,
	`rate_limit_enabled` boolean,
	`rate_limit_time_window` int,
	`rate_limit_max` int,
	`request_count` int DEFAULT 0,
	`remaining` int,
	`last_request` timestamp(3),
	`expires_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`permissions` text,
	`metadata` text,
	CONSTRAINT `apikey_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	`impersonated_by` varchar(36),
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `twoFactor` (
	`id` varchar(36) NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`verified` boolean DEFAULT true,
	CONSTRAINT `twoFactor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`role` varchar(255) DEFAULT 'user',
	`banned` boolean,
	`ban_reason` text,
	`ban_expires` timestamp(3),
	`two_factor_enabled` boolean DEFAULT false,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`ignored_files` text,
	`disk` varchar(36) NOT NULL DEFAULT 'local',
	`checksum` varchar(255),
	`bytes` bigint NOT NULL DEFAULT 0,
	`completed_at` timestamp(3),
	`is_locked` boolean NOT NULL DEFAULT false,
	`is_successful` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`),
	CONSTRAINT `backups_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `database_hosts` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 3306,
	`username` varchar(100) NOT NULL,
	`password` text NOT NULL,
	`max_databases` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `database_hosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `egg_variables` (
	`id` varchar(36) NOT NULL,
	`egg_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`env_variable` varchar(255) NOT NULL,
	`default_value` text,
	`user_viewable` boolean NOT NULL DEFAULT true,
	`user_editable` boolean NOT NULL DEFAULT true,
	`rules` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `egg_variables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eggs` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`nest_id` varchar(36) NOT NULL,
	`config_from` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text,
	`features` text,
	`docker_images` text NOT NULL,
	`stop_command` varchar(255),
	`startup` text NOT NULL,
	`config_files` text,
	`config_startup` text,
	`config_stop` text,
	`config_logs` text,
	`script_install` text,
	`script_entry` varchar(255) DEFAULT 'bash',
	`script_container` varchar(255),
	`script_extension` varchar(255) DEFAULT 'sh',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `eggs_id` PRIMARY KEY(`id`),
	CONSTRAINT `eggs_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`short` varchar(60) NOT NULL,
	`long` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`location_id` varchar(36) NOT NULL,
	`fqdn` varchar(255) NOT NULL,
	`scheme` varchar(10) NOT NULL DEFAULT 'https',
	`memory` int NOT NULL,
	`memory_overallocate` int NOT NULL DEFAULT 0,
	`disk` int NOT NULL,
	`disk_overallocate` int NOT NULL DEFAULT 0,
	`upload_size` int NOT NULL DEFAULT 100,
	`daemon_listen` int NOT NULL DEFAULT 8080,
	`daemon_sftp` int NOT NULL DEFAULT 2022,
	`daemon_base` varchar(255) NOT NULL DEFAULT '/var/lib/pterodactyl',
	`maintenance_mode` boolean NOT NULL DEFAULT false,
	`token_id` varchar(36) NOT NULL,
	`token` text NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `nodes_uuid_unique` UNIQUE(`uuid`),
	CONSTRAINT `nodes_tokenId_unique` UNIQUE(`token_id`)
);
--> statement-breakpoint
CREATE TABLE `nests` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`author` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `nests_id` PRIMARY KEY(`id`),
	CONSTRAINT `nests_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `mounts` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`source` varchar(255) NOT NULL,
	`target` varchar(255) NOT NULL,
	`read_only` boolean NOT NULL DEFAULT false,
	`user_mountable` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `mounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `mounts_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`uuid_short` varchar(8) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`user_id` varchar(36) NOT NULL,
	`node_id` varchar(36) NOT NULL,
	`egg_id` varchar(36) NOT NULL,
	`allocation_id` varchar(36) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT '',
	`power_state` varchar(20) DEFAULT 'offline',
	`suspended` boolean NOT NULL DEFAULT false,
	`memory` int NOT NULL,
	`disk` int NOT NULL,
	`cpu` int NOT NULL,
	`swap` int NOT NULL DEFAULT 0,
	`io` int NOT NULL DEFAULT 500,
	`threads` varchar(100),
	`oom_disabled` boolean NOT NULL DEFAULT false,
	`image` varchar(255) NOT NULL,
	`startup` text NOT NULL,
	`skip_scripts` boolean NOT NULL DEFAULT false,
	`invocation` text NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `servers_uuid_unique` UNIQUE(`uuid`),
	CONSTRAINT `servers_uuid_short_unique` UNIQUE(`uuid_short`)
);
--> statement-breakpoint
CREATE TABLE `server_variables` (
	`id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`variable_id` varchar(36) NOT NULL,
	`variable_value` text NOT NULL DEFAULT (''),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `server_variables_id` PRIMARY KEY(`id`),
	CONSTRAINT `server_variables_server_variable_unique` UNIQUE(`server_id`,`variable_id`)
);
--> statement-breakpoint
CREATE TABLE `server_mounts` (
	`id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`mount_id` varchar(36) NOT NULL,
	CONSTRAINT `server_mounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `server_mounts_unique` UNIQUE(`server_id`,`mount_id`)
);
--> statement-breakpoint
CREATE TABLE `server_databases` (
	`id` varchar(36) NOT NULL,
	`uuid` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`host_id` varchar(36) NOT NULL,
	`database` varchar(255) NOT NULL,
	`username` varchar(100) NOT NULL,
	`max_connections` int NOT NULL DEFAULT 0,
	`remote` varchar(15) NOT NULL DEFAULT '%',
	`password` text NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `server_databases_id` PRIMARY KEY(`id`),
	CONSTRAINT `server_databases_uuid_unique` UNIQUE(`uuid`)
);
--> statement-breakpoint
CREATE TABLE `schedule_tasks` (
	`id` varchar(36) NOT NULL,
	`schedule_id` varchar(36) NOT NULL,
	`sequence_id` int NOT NULL,
	`action` varchar(60) NOT NULL,
	`payload` text NOT NULL,
	`time_offset` int NOT NULL DEFAULT 0,
	`is_queued` boolean NOT NULL DEFAULT false,
	`continue_on_failure` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `schedule_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`cron_second` varchar(30) NOT NULL DEFAULT '0',
	`cron_minute` varchar(30) NOT NULL,
	`cron_hour` varchar(30) NOT NULL,
	`cron_day_of_week` varchar(30) NOT NULL,
	`cron_day_of_month` varchar(30) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_processing` boolean NOT NULL DEFAULT false,
	`timezone_offset` varchar(100),
	`last_run_at` timestamp(3),
	`next_run_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subusers` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`server_id` varchar(36) NOT NULL,
	`permissions` text NOT NULL DEFAULT ('[]'),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `subusers_id` PRIMARY KEY(`id`),
	CONSTRAINT `subusers_user_server_unique` UNIQUE(`user_id`,`server_id`)
);
--> statement-breakpoint
ALTER TABLE `node_allocations` ADD CONSTRAINT `node_allocations_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `twoFactor` ADD CONSTRAINT `twoFactor_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backups` ADD CONSTRAINT `backups_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `egg_variables` ADD CONSTRAINT `egg_variables_egg_id_eggs_id_fk` FOREIGN KEY (`egg_id`) REFERENCES `eggs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eggs` ADD CONSTRAINT `eggs_nest_id_nests_id_fk` FOREIGN KEY (`nest_id`) REFERENCES `nests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `nodes` ADD CONSTRAINT `nodes_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_egg_id_eggs_id_fk` FOREIGN KEY (`egg_id`) REFERENCES `eggs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `servers` ADD CONSTRAINT `servers_allocation_id_node_allocations_id_fk` FOREIGN KEY (`allocation_id`) REFERENCES `node_allocations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_variables` ADD CONSTRAINT `server_variables_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_variables` ADD CONSTRAINT `server_variables_variable_id_egg_variables_id_fk` FOREIGN KEY (`variable_id`) REFERENCES `egg_variables`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_mounts` ADD CONSTRAINT `server_mounts_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_mounts` ADD CONSTRAINT `server_mounts_mount_id_mounts_id_fk` FOREIGN KEY (`mount_id`) REFERENCES `mounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_databases` ADD CONSTRAINT `server_databases_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `server_databases` ADD CONSTRAINT `server_databases_host_id_database_hosts_id_fk` FOREIGN KEY (`host_id`) REFERENCES `database_hosts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_tasks` ADD CONSTRAINT `schedule_tasks_schedule_id_schedules_id_fk` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subusers` ADD CONSTRAINT `subusers_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subusers` ADD CONSTRAINT `subusers_server_id_servers_id_fk` FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_serverId_idx` ON `activity_logs` (`server_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_userId_idx` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_timestamp_idx` ON `activity_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `allocations_nodeId_idx` ON `node_allocations` (`node_id`);--> statement-breakpoint
CREATE INDEX `allocations_serverId_idx` ON `node_allocations` (`server_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `backups_serverId_idx` ON `backups` (`server_id`);--> statement-breakpoint
CREATE INDEX `egg_variables_eggId_idx` ON `egg_variables` (`egg_id`);--> statement-breakpoint
CREATE INDEX `eggs_nestId_idx` ON `eggs` (`nest_id`);--> statement-breakpoint
CREATE INDEX `nodes_locationId_idx` ON `nodes` (`location_id`);--> statement-breakpoint
CREATE INDEX `servers_userId_idx` ON `servers` (`user_id`);--> statement-breakpoint
CREATE INDEX `servers_nodeId_idx` ON `servers` (`node_id`);--> statement-breakpoint
CREATE INDEX `servers_eggId_idx` ON `servers` (`egg_id`);--> statement-breakpoint
CREATE INDEX `server_variables_serverId_idx` ON `server_variables` (`server_id`);--> statement-breakpoint
CREATE INDEX `server_mounts_serverId_idx` ON `server_mounts` (`server_id`);--> statement-breakpoint
CREATE INDEX `server_databases_serverId_idx` ON `server_databases` (`server_id`);--> statement-breakpoint
CREATE INDEX `schedule_tasks_scheduleId_idx` ON `schedule_tasks` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `schedules_serverId_idx` ON `schedules` (`server_id`);--> statement-breakpoint
CREATE INDEX `subusers_userId_idx` ON `subusers` (`user_id`);--> statement-breakpoint
CREATE INDEX `subusers_serverId_idx` ON `subusers` (`server_id`);