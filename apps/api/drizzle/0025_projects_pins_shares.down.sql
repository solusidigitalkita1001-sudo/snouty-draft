-- Rollback untuk 0025: tautan bagikan berhenti bekerja, proyek dan sematan hilang; konsultasi tetap ada.
DROP TABLE `share_links`;
--> statement-breakpoint
ALTER TABLE `conversations`
  DROP KEY `ix_conversations_owner_pinned`,
  DROP KEY `ix_conversations_project`,
  DROP COLUMN `pinned_at`,
  DROP COLUMN `project_id`;
--> statement-breakpoint
DROP TABLE `projects`;
