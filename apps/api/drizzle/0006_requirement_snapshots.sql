CREATE TABLE `requirement_snapshots` (
	`id` char(26) NOT NULL,
	`conversation_id` char(26) NOT NULL,
	`version` int NOT NULL,
	`state` json NOT NULL,
	`trigger` varchar(24) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `requirement_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_snapshots_trigger` CHECK(`trigger` IN ('extraction','clarification_answer','user_edit','default_applied'))
);
--> statement-breakpoint
ALTER TABLE `requirement_snapshots` ADD CONSTRAINT `fk_snapshots_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_snapshots_conversation_version` ON `requirement_snapshots` (`conversation_id`,`version`);
