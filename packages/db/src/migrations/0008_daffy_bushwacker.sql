CREATE TABLE `backup_destinations` (
	`id` varchar(36) NOT NULL,
	`node_id` varchar(36),
	`type` varchar(36) NOT NULL,
	`config` text NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_destinations_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_destinations_nodeId_unique` UNIQUE(`node_id`)
);
--> statement-breakpoint
ALTER TABLE `backup_destinations` ADD CONSTRAINT `backup_destinations_node_id_nodes_id_fk` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `backup_destinations_nodeId_idx` ON `backup_destinations` (`node_id`);