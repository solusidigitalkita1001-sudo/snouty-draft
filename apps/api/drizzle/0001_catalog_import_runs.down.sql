-- Rollback untuk 0001_catalog_import_runs.sql.
--
-- Urutan dibalik dari urutan create: indeks dulu, lalu kolom, lalu tabel.
--
-- Catatan: MySQL 8 tidak punya `DROP INDEX IF EXISTS`, jadi berkas ini
-- mengandaikan 0001 memang sudah berjalan. Itu kontrak yang sama dengan
-- 0000_catalog.down.sql dan diuji oleh urutan naik → turun → naik di
-- scripts/test-migration.mjs.

ALTER TABLE `products` DROP INDEX `uq_products_version_row_hash`;
--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `row_hash`;
--> statement-breakpoint
DROP TABLE IF EXISTS `catalog_import_runs`;
