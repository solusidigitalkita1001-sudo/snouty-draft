-- Rollback untuk 0013_catalog_version_kind.sql. CHECK dulu: ia merujuk kolomnya.
ALTER TABLE `catalog_versions` DROP CHECK `ck_catalog_versions_kind`;
--> statement-breakpoint
ALTER TABLE `catalog_versions` DROP COLUMN `kind`;
