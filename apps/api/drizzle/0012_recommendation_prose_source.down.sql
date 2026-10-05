-- Rollback untuk 0012_recommendation_prose_source.sql. CHECK dulu: ia merujuk kolomnya.
ALTER TABLE `recommendations` DROP CHECK `ck_recommendations_prose_source`;
--> statement-breakpoint
ALTER TABLE `recommendations` DROP COLUMN `prose_source`;
