-- Rollback untuk 0010_intelligence.sql. `email_analyses` dulu: ia merujuk `emails`.
DROP TABLE IF EXISTS `email_analyses`;
--> statement-breakpoint
DROP TABLE IF EXISTS `emails`;
--> statement-breakpoint
DROP TABLE IF EXISTS `market_events`;
