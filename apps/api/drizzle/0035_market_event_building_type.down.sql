-- Rollback untuk 0035. Baris yang nilainya lebih panjang dari 24 huruf dipotong MySQL, jadi
-- rollback hanya aman bila event gedung bertingkat belum tercatat.
ALTER TABLE `market_events` MODIFY COLUMN `building_type` varchar(24) NULL;
