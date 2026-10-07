-- Rollback untuk 0018: kolom opsional, tidak ada data lain yang bergantung padanya.
ALTER TABLE `recommendations` DROP COLUMN `composition`;
