-- Rollback untuk 0015_recommendation_technical.sql. Baris `technical` harus dihapus dulu —
-- CHECK lama tidak mengenalnya.
DELETE FROM `recommendations` WHERE `kind` = 'technical';
--> statement-breakpoint
ALTER TABLE `recommendations` DROP COLUMN `highlights`;
--> statement-breakpoint
ALTER TABLE `recommendations` DROP CHECK `ck_recommendations_kind`;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `ck_recommendations_kind` CHECK(`kind` IN ('building','irrigation'));
