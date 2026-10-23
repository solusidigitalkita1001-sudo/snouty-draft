-- P27-07 (pemilik 2026-10-23: "notifikasi belum ada"): pemberitahuan di dalam aplikasi, untuk akun.
--
-- Barisnya menyimpan KEJADIAN, bukan kalimat: `kind` + `subject_id` + `data`. Teks yang dibaca orang
-- dirakit di lapisan tampilan per bahasa — kalimat Indonesia yang dibekukan di database tidak bisa
-- berbahasa Inggris nanti, dan tidak bisa diperbaiki tanpa migration.
CREATE TABLE `notifications` (
  `id` char(26) NOT NULL,
  `user_id` char(26) NOT NULL,
  `kind` varchar(32) NOT NULL,
  `subject_id` char(26) NULL,
  `data` json NULL,
  `read_at` datetime(3) NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_notifications_user_created` (`user_id`, `created_at`),
  KEY `ix_notifications_user_unread` (`user_id`, `read_at`),
  CONSTRAINT `ck_notifications_kind`
    CHECK (`kind` IN ('lead_assigned','contact_requested','report_ready'))
);
