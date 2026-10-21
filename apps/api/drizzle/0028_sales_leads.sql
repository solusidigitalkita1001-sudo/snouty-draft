-- P26-05 (pemilik 2026-10-21): dashboard admin menugaskan prospek ke sales. Peran baru `sales` hanya
-- melihat prospek miliknya (OQ-76). Satu prospek (pengguna) = satu penugasan aktif; dipindah, bukan
-- digandakan. `summary` diisi ringkasan percakapan saat P26-06.
ALTER TABLE `user_roles` DROP CHECK `ck_user_roles_role`;
--> statement-breakpoint
ALTER TABLE `user_roles`
  ADD CONSTRAINT `ck_user_roles_role` CHECK (`role` IN ('sales_reviewer','technical_team','catalog_admin','domain_expert','admin','sales'));
--> statement-breakpoint
CREATE TABLE `sales_leads` (
  `id` char(26) NOT NULL,
  `user_id` char(26) NOT NULL,
  `assigned_to` char(26) NOT NULL,
  `assigned_by` char(26) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'new',
  `lost_reason` varchar(255) NULL,
  `summary` json NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_leads_user` (`user_id`),
  KEY `ix_sales_leads_assignee_status` (`assigned_to`, `status`),
  CONSTRAINT `ck_sales_leads_status` CHECK (`status` IN ('new','contacted','quoted','won','lost'))
);
--> statement-breakpoint
-- Admin pertama (pemilik 2026-10-21, AskUserQuestion): akun pemilik. Admin berikutnya dan tim sales
-- ditambahkan dari dashboard. Tanpa akun itu (database lain), pernyataan ini tidak berbuat apa-apa.
INSERT IGNORE INTO `user_roles` (`user_id`, `role`)
  SELECT `id`, 'admin' FROM `users` WHERE `email` = 'bagus.oetomo11@gmail.com';
