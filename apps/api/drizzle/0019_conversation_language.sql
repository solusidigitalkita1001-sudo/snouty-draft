-- Fase 15 (P15-01): bahasa percakapan — ditetapkan saat dibuat, dipakai untuk jawaban model dan
-- (bertahap) teks deterministik. Baris lama = Indonesia, bahasa satu-satunya sebelum 0019.
ALTER TABLE `conversations` ADD COLUMN `language` VARCHAR(2) NOT NULL DEFAULT 'id' AFTER `stage`;
--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `ck_conversations_language` CHECK (`language` IN ('id','en'));
