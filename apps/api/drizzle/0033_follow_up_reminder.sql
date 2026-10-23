-- P28-01: pengingat tindak lanjut yang berbunyi sendiri.
--
-- 0032 menyimpan KAPAN sebuah prospek perlu ditengok lagi, tapi tidak ada yang membangunkan
-- siapa pun saat harinya tiba: tanggalnya hanya ditandai merah bila sales kebetulan membuka
-- layarnya. Dua hal yang ditambahkan: penanda bahwa pengingat untuk jadwal itu sudah dikirim,
-- dan jenis pemberitahuan baru.
--
-- Penandanya menyimpan JADWAL yang sudah diingatkan, bukan `1`/`0`: dengan begitu menggeser
-- tanggal tengok membuat pengingatnya berbunyi lagi, tanpa perlu ada yang meresetnya.
ALTER TABLE `sales_leads`
  ADD COLUMN `follow_up_reminded_for` datetime(3) NULL AFTER `follow_up_at`;
--> statement-breakpoint
CREATE INDEX `ix_sales_leads_follow_up` ON `sales_leads` (`follow_up_at`);
--> statement-breakpoint
ALTER TABLE `notifications` DROP CHECK `ck_notifications_kind`;
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `ck_notifications_kind`
  CHECK (`kind` IN ('lead_assigned','contact_requested','report_ready','follow_up_due'));
