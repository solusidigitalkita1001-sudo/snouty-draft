-- Rollback untuk 0011_catalog_foreign_keys.sql.
ALTER TABLE `product_compatibility` DROP FOREIGN KEY `fk_product_compatibility_compatible`;
--> statement-breakpoint
ALTER TABLE `product_compatibility` DROP FOREIGN KEY `fk_product_compatibility_product`;
--> statement-breakpoint
ALTER TABLE `product_images` DROP FOREIGN KEY `fk_product_images_product`;
--> statement-breakpoint
ALTER TABLE `product_documents` DROP FOREIGN KEY `fk_product_documents_product`;
--> statement-breakpoint
ALTER TABLE `product_specs` DROP FOREIGN KEY `fk_product_specs_product`;
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP FOREIGN KEY `fk_product_sizes_product`;
--> statement-breakpoint
ALTER TABLE `products` DROP FOREIGN KEY `fk_products_version`;
