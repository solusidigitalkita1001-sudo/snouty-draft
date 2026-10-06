-- Rollback untuk 0014_recommendation_kind.sql. CHECK dulu: ia merujuk kolomnya.
ALTER TABLE `recommendations` DROP CHECK `ck_recommendations_kind`;
--> statement-breakpoint
ALTER TABLE `recommendations` DROP COLUMN `kind`;
--> statement-breakpoint
ALTER TABLE `recommendations` DROP COLUMN `irrigation_stats`;
