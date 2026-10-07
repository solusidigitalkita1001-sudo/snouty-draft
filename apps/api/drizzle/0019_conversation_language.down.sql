-- Rollback untuk 0019: percakapan berbahasa Inggris kehilangan penandanya (teks tersimpannya tetap).
ALTER TABLE `conversations` DROP CHECK `ck_conversations_language`;
--> statement-breakpoint
ALTER TABLE `conversations` DROP COLUMN `language`;
