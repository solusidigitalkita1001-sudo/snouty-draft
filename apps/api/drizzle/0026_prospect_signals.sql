-- P26-02 (pemilik 2026-10-21, docs/PROSPECT_5A.md §2): instrumentasi tahap 5A. Label intent per pesan
-- (hanya label, tanpa teks tambahan) dan kejadian yang tidak meninggalkan baris lain: unduh laporan,
-- buka detail produk oleh pengguna terdaftar, kunjungan tautan bagikan. Tahap dihitung saat dibaca,
-- lewat pemilik percakapan, sehingga sinyal tamu ikut pindah saat tamu mendaftar.
ALTER TABLE `messages`
  ADD COLUMN `intent` varchar(48) NULL AFTER `mood`;
--> statement-breakpoint
-- `ref_id`: id laporan, id produk, atau SHA-256 token tautan (token mentah tidak pernah disimpan).
-- `dedupe_key`: satu baris per jenis × rujukan × pengguna × hari — unduhan berulang tidak menggelembung.
CREATE TABLE `prospect_signals` (
  `id` char(26) NOT NULL,
  `kind` varchar(24) NOT NULL,
  `ref_id` varchar(64) NOT NULL,
  `user_id` char(26) NULL,
  `occurred_on` date NOT NULL,
  `dedupe_key` char(64) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prospect_signals_dedupe` (`dedupe_key`),
  KEY `ix_prospect_signals_kind_ref` (`kind`, `ref_id`),
  KEY `ix_prospect_signals_user_day` (`user_id`, `occurred_on`),
  CONSTRAINT `ck_prospect_signals_kind` CHECK (`kind` IN ('report_download','product_view','share_visit'))
);
