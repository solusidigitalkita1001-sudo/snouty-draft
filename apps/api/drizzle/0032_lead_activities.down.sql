-- Rollback untuk 0032: jejak tindak lanjut hilang; status terakhir tetap ada di `sales_leads`.
DROP TABLE `lead_activities`;
--> statement-breakpoint
ALTER TABLE `sales_leads` DROP COLUMN `follow_up_at`;
