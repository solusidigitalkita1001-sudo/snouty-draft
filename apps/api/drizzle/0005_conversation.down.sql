-- Rollback untuk 0005_conversation.sql. `messages` dulu: ia merujuk `conversations`.
DROP TABLE IF EXISTS `messages`;
--> statement-breakpoint
DROP TABLE IF EXISTS `conversations`;
