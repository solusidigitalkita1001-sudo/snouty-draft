CREATE TABLE `catalog_versions` (
	`id` char(26) NOT NULL,
	`label` varchar(32) NOT NULL,
	`source_document` varchar(255) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`effective_from` datetime(3) NOT NULL,
	`imported_by` char(26) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`active_guard` varchar(6) GENERATED ALWAYS AS ((CASE WHEN `status` = 'active' THEN 'active' ELSE NULL END)) VIRTUAL,
	CONSTRAINT `catalog_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_catalog_versions_label` UNIQUE(`label`),
	CONSTRAINT `uq_catalog_versions_single_active` UNIQUE(`active_guard`),
	CONSTRAINT `ck_catalog_versions_status` CHECK(`status` IN ('draft','active','archived'))
);
--> statement-breakpoint
CREATE TABLE `product_compatibility` (
	`product_id` char(26) NOT NULL,
	`compatible_product_id` char(26) NOT NULL,
	`kind` varchar(24) NOT NULL,
	CONSTRAINT `product_compatibility_product_id_compatible_product_id_pk` PRIMARY KEY(`product_id`,`compatible_product_id`),
	CONSTRAINT `ck_product_compatibility_kind` CHECK(`kind` IN ('tee','elbow','reducer','socket')),
	CONSTRAINT `ck_product_compatibility_not_self` CHECK(`product_id` <> `compatible_product_id`)
);
--> statement-breakpoint
CREATE TABLE `product_documents` (
	`id` char(26) NOT NULL,
	`product_id` char(26) NOT NULL,
	`title` varchar(255) NOT NULL,
	`url` varchar(512) NOT NULL,
	`page` int,
	CONSTRAINT `product_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` char(26) NOT NULL,
	`product_id` char(26) NOT NULL,
	`url` varchar(512) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_sizes` (
	`product_id` char(26) NOT NULL,
	`size_inches_x1000` int NOT NULL,
	`size_label` varchar(16) NOT NULL,
	`available` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `product_sizes_product_id_size_inches_x1000_pk` PRIMARY KEY(`product_id`,`size_inches_x1000`),
	CONSTRAINT `ck_product_sizes_positive` CHECK(`size_inches_x1000` > 0)
);
--> statement-breakpoint
CREATE TABLE `product_specs` (
	`product_id` char(26) NOT NULL,
	`spec_key` varchar(48) NOT NULL,
	`spec_value` varchar(255),
	`provenance` varchar(16) NOT NULL,
	`source_document` varchar(255),
	`source_page` int,
	CONSTRAINT `product_specs_product_id_spec_key_pk` PRIMARY KEY(`product_id`,`spec_key`),
	CONSTRAINT `ck_product_specs_provenance` CHECK(`provenance` IN ('VERIFIED','UNAVAILABLE')),
	CONSTRAINT `ck_product_specs_empty_is_unavailable` CHECK((`spec_value` IS NOT NULL) OR (`provenance` = 'UNAVAILABLE'))
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(26) NOT NULL,
	`catalog_version_id` char(26) NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`family` varchar(80) NOT NULL,
	`category` varchar(120) NOT NULL,
	`description` text,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`source_document` varchar(255) NOT NULL,
	`source_page` int NOT NULL,
	`image_url` varchar(512),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_products_version_sku` UNIQUE(`catalog_version_id`,`sku`),
	CONSTRAINT `ck_products_status` CHECK(`status` IN ('active','discontinued')),
	CONSTRAINT `ck_products_source_page` CHECK(`source_page` > 0)
);
--> statement-breakpoint
CREATE INDEX `ix_catalog_versions_status` ON `catalog_versions` (`status`);--> statement-breakpoint
CREATE INDEX `ix_product_compatibility_kind` ON `product_compatibility` (`product_id`,`kind`);--> statement-breakpoint
CREATE INDEX `ix_product_documents_product` ON `product_documents` (`product_id`);--> statement-breakpoint
CREATE INDEX `ix_product_images_product` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `ix_product_sizes_lookup` ON `product_sizes` (`product_id`,`size_inches_x1000`);--> statement-breakpoint
CREATE INDEX `ix_products_family_category_status` ON `products` (`family`,`category`,`status`);--> statement-breakpoint
CREATE INDEX `ix_products_catalog_version` ON `products` (`catalog_version_id`);