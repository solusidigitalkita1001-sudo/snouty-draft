CREATE TABLE `catalog_import_runs` (
	`id` char(26) NOT NULL,
	`label` varchar(32) NOT NULL,
	`source_document` varchar(255) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`catalog_version_id` char(26),
	`rows_accepted` int NOT NULL DEFAULT 0,
	`rows_rejected` int NOT NULL DEFAULT 0,
	`issues` json,
	`requested_by` char(26) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`finished_at` datetime(3),
	CONSTRAINT `catalog_import_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_import_runs_version` UNIQUE(`catalog_version_id`),
	CONSTRAINT `ck_catalog_import_runs_status` CHECK(`status` IN ('pending','rejected','ingested','failed'))
);
--> statement-breakpoint
ALTER TABLE `products` ADD `row_hash` char(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `uq_products_version_row_hash` UNIQUE(`catalog_version_id`,`row_hash`);--> statement-breakpoint
CREATE INDEX `ix_catalog_import_runs_status` ON `catalog_import_runs` (`status`);