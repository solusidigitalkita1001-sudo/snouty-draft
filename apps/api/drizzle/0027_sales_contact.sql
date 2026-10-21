-- P26-04 (OQ-76, pemilik 2026-10-21): sales Pralon hanya menghubungi pengguna yang mengizinkannya —
-- opt-in "boleh dihubungi tim Pralon" (consent SALES_CONTACT, bisa dicabut di menu Akun) — atau yang
-- menekan "minta dihubungi" sendiri (`sales_requests`). Hanya pengguna terdaftar.
ALTER TABLE `consents` DROP CHECK `ck_consents_kind`;
--> statement-breakpoint
ALTER TABLE `consents`
  ADD CONSTRAINT `ck_consents_kind` CHECK (`kind` IN ('LOCATION','ANALYTICS_STORAGE','SALES_CONTACT'));
--> statement-breakpoint
-- `source`: dari mana permintaan datang (layar solusi atau jawaban harga) — untuk sales, bukan untuk
-- rekomendasi. Status penugasan dan tindak lanjutnya milik `sales_leads` (P26-05).
CREATE TABLE `sales_requests` (
  `id` char(26) NOT NULL,
  `user_id` char(26) NOT NULL,
  `conversation_id` char(26) NULL,
  `source` varchar(16) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_sales_requests_user_created` (`user_id`, `created_at`),
  KEY `ix_sales_requests_conversation` (`conversation_id`),
  CONSTRAINT `ck_sales_requests_source` CHECK (`source` IN ('solution','price'))
);
