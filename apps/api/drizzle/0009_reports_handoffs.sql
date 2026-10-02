CREATE TABLE `reports` (
	`id` char(26) NOT NULL,
	`recommendation_id` char(26) NOT NULL,
	`report_number` varchar(20) NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'PENDING',
	`payload_json` json NOT NULL,
	`file_ref` varchar(255),
	`failure_reason` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`completed_at` datetime(3),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_reports_status` CHECK(`status` IN ('PENDING','READY','FAILED'))
);
--> statement-breakpoint
CREATE TABLE `report_number_counters` (
	`year_month` char(7) NOT NULL,
	`last_seq` int NOT NULL DEFAULT 0,
	CONSTRAINT `report_number_counters_year_month` PRIMARY KEY(`year_month`)
);
--> statement-breakpoint
CREATE TABLE `technical_handoffs` (
	`id` char(26) NOT NULL,
	`conversation_id` char(26) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`captured_json` json NOT NULL,
	`status` varchar(12) NOT NULL DEFAULT 'QUEUED',
	`assigned_to` char(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` datetime(3),
	CONSTRAINT `technical_handoffs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_handoffs_status` CHECK(`status` IN ('QUEUED','IN_REVIEW','RESOLVED','CLOSED'))
);
--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `fk_reports_recommendation` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technical_handoffs` ADD CONSTRAINT `fk_handoffs_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reports_number` ON `reports` (`report_number`);--> statement-breakpoint
CREATE INDEX `ix_reports_recommendation` ON `reports` (`recommendation_id`);--> statement-breakpoint
CREATE INDEX `ix_reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_handoffs_status_created` ON `technical_handoffs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_handoffs_conversation` ON `technical_handoffs` (`conversation_id`);
