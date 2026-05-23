ALTER TABLE `user` ADD `billing_name` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_address_line1` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_address_line2` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_city` varchar(100);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_state` varchar(100);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_postal_code` varchar(20);--> statement-breakpoint
ALTER TABLE `user` ADD `billing_country` varchar(2);--> statement-breakpoint
ALTER TABLE `user` ADD `vat_number` varchar(50);--> statement-breakpoint
ALTER TABLE `user` ADD `vat_country` varchar(2);