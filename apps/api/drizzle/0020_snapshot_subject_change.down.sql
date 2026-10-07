-- Rollback untuk 0020: baris berpemicu `subject_change` harus dihapus dulu, kalau tidak CHECK lama gagal dipasang.
DELETE FROM `requirement_snapshots` WHERE `trigger` = 'subject_change';
--> statement-breakpoint
ALTER TABLE `requirement_snapshots` DROP CHECK `ck_snapshots_trigger`;
--> statement-breakpoint
ALTER TABLE `requirement_snapshots` ADD CONSTRAINT `ck_snapshots_trigger` CHECK (`trigger` IN ('extraction','clarification_answer','user_edit','default_applied'));
