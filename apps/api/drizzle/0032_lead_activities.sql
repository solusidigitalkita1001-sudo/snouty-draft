-- P27-09 (pemilik 2026-10-23: "CRM mengenai prospek harus di dalemin lebih lanjut").
--
-- Sampai sekarang yang tercatat dari sebuah prospek hanyalah statusnya SEKARANG. Tidak ada jejak
-- apa yang terjadi: kapan dihubungi, apa kata pelanggannya, kapan harus ditengok lagi. Dua hal
-- yang ditambahkan: catatan tindak lanjut (beserta riwayat perubahan status) dan tanggal tengok
-- berikutnya.
ALTER TABLE `sales_leads` ADD COLUMN `follow_up_at` datetime(3) NULL AFTER `lost_reason`;
--> statement-breakpoint
CREATE TABLE `lead_activities` (
  `id` char(26) NOT NULL,
  `user_id` char(26) NOT NULL,
  `actor_id` char(26) NOT NULL,
  `kind` varchar(16) NOT NULL,
  `note` varchar(1000) NULL,
  `status` varchar(16) NULL,
  `follow_up_at` datetime(3) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_lead_activities_user` (`user_id`, `id`),
  CONSTRAINT `ck_lead_activities_kind` CHECK (`kind` IN ('note','status','follow_up','assigned'))
);
