-- Rollback untuk 0000_catalog.sql.
--
-- Ditulis tangan, sesuai docs/DATABASE.md §4 langkah 3: setiap migration
-- mengirim jalur mundurnya sendiri. Urutan drop dibalik dari urutan create.
--
-- Migration ini hanya membuat tabel baru dalam konteks katalog, jadi rollback-nya
-- aman: tidak ada tabel milik konteks lain, dan tidak ada data yang dibagi.

DROP TABLE IF EXISTS `product_images`;
DROP TABLE IF EXISTS `product_documents`;
DROP TABLE IF EXISTS `product_compatibility`;
DROP TABLE IF EXISTS `product_specs`;
DROP TABLE IF EXISTS `product_sizes`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `catalog_versions`;
