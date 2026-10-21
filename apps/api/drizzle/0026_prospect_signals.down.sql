-- Rollback untuk 0026: sinyal prospek dan label intent hilang; percakapan tetap ada.
DROP TABLE `prospect_signals`;
--> statement-breakpoint
ALTER TABLE `messages`
  DROP COLUMN `intent`;
