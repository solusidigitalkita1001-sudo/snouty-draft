-- OQ-44 — dari mana prosa sebuah rekomendasi berasal (docs/OPEN_QUESTIONS.md).
--
-- `llm_calls` mencatat setiap panggilan sebagai `success` walaupun prosanya kemudian
-- ditolak REC-1 di perakitan — dan memang harus begitu: `ai` tidak boleh tahu angka mana
-- yang sah. Jadi laju "model mengarang angka" dicatat di sini, pada rekomendasi yang
-- terdampak, oleh pihak yang memang mengetahuinya.
--
-- NULL berarti "sebelum kolom ini ada": baris lama tidak diberi nilai tebakan, karena
-- metrik yang isinya separuh tebakan lebih buruk daripada metrik yang jujur mulai dari
-- tanggal tertentu.
ALTER TABLE `recommendations` ADD COLUMN `prose_source` varchar(12) NULL AFTER `body`;
--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `ck_recommendations_prose_source` CHECK(`prose_source` IN ('llm','llm_retry','template'));
