-- Jalur guna rekomendasi (OQ-47): `building` (bawaan, seluruh baris lama) atau `irrigation`,
-- plus statistik irigasi yang bentuknya berbeda dari lima statistik bangunan. Kolom `stats`
-- tetap terisi untuk pembaca lama (laporan, riwayat).
ALTER TABLE `recommendations` ADD COLUMN `kind` varchar(12) NOT NULL DEFAULT 'building' AFTER `body`;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `ck_recommendations_kind` CHECK(`kind` IN ('building','irrigation'));
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `irrigation_stats` json NULL AFTER `stats`;
