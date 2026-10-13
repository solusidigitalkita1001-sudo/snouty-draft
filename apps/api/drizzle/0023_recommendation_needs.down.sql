-- Rollback untuk 0023: kebutuhan bergambar hilang; Ringkasan kembali tanpa gambar.
ALTER TABLE `recommendations` DROP COLUMN `needs`;
