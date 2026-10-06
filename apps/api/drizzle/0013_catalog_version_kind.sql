-- Asal data versi katalog: `pralon` (impor dokumen Pralon) atau `sample` (katalog contoh
-- pengembangan, `seed:sample`). docs/PRODUCT_KNOWLEDGE.md §4 · OQ-46.
--
-- Sebelum kolom ini, satu-satunya tanda bahwa katalog aktif adalah karangan ada di teks
-- (`source_document` "BUKAN data Pralon", nama "CONTOH …"). Teks bukan pagar: pipeline
-- jawaban sempat menyatakan "HDPE tidak ada di katalog Pralon" berdasarkan katalog contoh.
-- Kini `product-catalog` menolak versi `sample` sebagai versi aktif di luar development, dan
-- klaim ketersediaan produk Pralon hanya dibuat atas versi `pralon`.
ALTER TABLE `catalog_versions` ADD COLUMN `kind` varchar(8) NOT NULL DEFAULT 'pralon' AFTER `source_document`;
--> statement-breakpoint
ALTER TABLE `catalog_versions` ADD CONSTRAINT `ck_catalog_versions_kind` CHECK(`kind` IN ('pralon','sample'));
--> statement-breakpoint
-- Versi yang sudah ada dari `seed:sample` dikenali dari dokumen sumbernya yang tetap — satu
-- kali, saat migrasi; sesudah ini `kind` ditulis oleh jalur impor, bukan ditebak dari teks.
UPDATE `catalog_versions` SET `kind` = 'sample' WHERE `source_document` LIKE '%BUKAN data Pralon%';
