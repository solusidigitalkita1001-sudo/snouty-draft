CREATE TABLE `conversations` (
	`id` char(26) NOT NULL,
	`owner_kind` varchar(8) NOT NULL,
	`owner_id` char(26) NOT NULL,
	`title` varchar(160),
	`status` varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
	`stage` varchar(12) NOT NULL DEFAULT 'KEBUTUHAN',
	`current_snapshot_id` char(26),
	`recommendation_id` char(26),
	`catalog_version_id` char(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`deleted_at` datetime(3),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_conversations_owner_kind` CHECK(`owner_kind` IN ('user','guest')),
	CONSTRAINT `ck_conversations_status` CHECK(`status` IN ('IN_PROGRESS','CHECKING_DATA','ANALYZING','INCOMPLETE_DATA','SOLUTION_READY','NEEDS_VALIDATION','SAVED','REOPENED')),
	CONSTRAINT `ck_conversations_stage` CHECK(`stage` IN ('KEBUTUHAN','ANALISIS','SOLUSI','LAPORAN'))
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` char(26) NOT NULL,
	`conversation_id` char(26) NOT NULL,
	`role` varchar(10) NOT NULL,
	`text` text NOT NULL,
	`cards` json,
	`mood` varchar(16),
	`llm_call_id` char(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_messages_role` CHECK(`role` IN ('user','assistant'))
);
--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_conversations_owner_updated` ON `conversations` (`owner_kind`,`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ix_conversations_status_updated` ON `conversations` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ix_messages_conversation_created` ON `messages` (`conversation_id`,`created_at`);