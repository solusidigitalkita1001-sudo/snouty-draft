-- P24-01..03 (pemilik 2026-10-19: fitur akun ala Claude): proyek pengelompok konsultasi dengan catatan
-- yang ikut dibaca sebagai konteks, sematkan (pin) konsultasi, dan tautan bagikan baca-saja.
-- Semua kolom baru NULL-able: baris sebelum 0025 tetap sah (tanpa proyek, tidak disematkan).
CREATE TABLE `projects` (
  `id` char(26) NOT NULL,
  `owner_id` char(26) NOT NULL,
  `name` varchar(80) NOT NULL,
  `notes` text NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at` datetime(3) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_projects_owner_updated` (`owner_id`, `updated_at`)
);
--> statement-breakpoint
ALTER TABLE `conversations`
  ADD COLUMN `project_id` char(26) NULL AFTER `catalog_version_id`,
  ADD COLUMN `pinned_at` datetime(3) NULL AFTER `project_id`,
  ADD KEY `ix_conversations_project` (`project_id`, `updated_at`),
  ADD KEY `ix_conversations_owner_pinned` (`owner_kind`, `owner_id`, `pinned_at`);
--> statement-breakpoint
-- Token tautan tidak pernah disimpan: hanya SHA-256-nya. Tautan aktif = revoked_at NULL.
CREATE TABLE `share_links` (
  `id` char(26) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `recommendation_id` char(26) NOT NULL,
  `conversation_id` char(26) NOT NULL,
  `owner_id` char(26) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at` datetime(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_share_links_token` (`token_hash`),
  KEY `ix_share_links_recommendation` (`recommendation_id`, `revoked_at`)
);
