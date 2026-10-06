-- Kasus teknis umum (Fase 14): jalur guna `technical` (kolam/tambak, transfer pompa, …) dengan
-- statistik ringkasan berlabel bahasa pengguna (`highlights`), karena bentuk statistiknya
-- berbeda per kasus. Kolom `stats` tetap terisi untuk pembaca lama.
ALTER TABLE `recommendations` DROP CHECK `ck_recommendations_kind`;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `ck_recommendations_kind` CHECK(`kind` IN ('building','irrigation','technical'));
--> statement-breakpoint
ALTER TABLE `recommendations` ADD COLUMN `highlights` json NULL AFTER `irrigation_stats`;
