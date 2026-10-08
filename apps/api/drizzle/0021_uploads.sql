-- P13-06: lampiran denah ("Lampirkan denah", docs/SECURITY.md §7). Berkasnya di STORAGE_PATH/uploads
-- dengan nama ULID; tabel ini hanya metadata. Retensi 180 hari (OQ-13) lewat `expires_at`.
CREATE TABLE `uploads` (
	`id` char(26) NOT NULL,
	`conversation_id` char(26) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(32) NOT NULL,
	`size_bytes` int unsigned NOT NULL,
	`sha256` char(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	CONSTRAINT `uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_uploads_mime` CHECK(`mime_type` IN ('application/pdf','image/png','image/jpeg','image/webp'))
);
--> statement-breakpoint
ALTER TABLE `uploads` ADD CONSTRAINT `fk_uploads_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `ix_uploads_conversation` ON `uploads` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `ix_uploads_expires` ON `uploads` (`expires_at`);
