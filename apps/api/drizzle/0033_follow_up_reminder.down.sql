-- Rollback untuk 0033. Pemberitahuan `follow_up_due` yang terlanjur ada dihapus lebih dulu,
-- karena CHECK yang lama akan menolaknya.
DELETE FROM `notifications` WHERE `kind` = 'follow_up_due';
--> statement-breakpoint
ALTER TABLE `notifications` DROP CHECK `ck_notifications_kind`;
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `ck_notifications_kind`
  CHECK (`kind` IN ('lead_assigned','contact_requested','report_ready'));
--> statement-breakpoint
DROP INDEX `ix_sales_leads_follow_up` ON `sales_leads`;
--> statement-breakpoint
ALTER TABLE `sales_leads` DROP COLUMN `follow_up_reminded_for`;
