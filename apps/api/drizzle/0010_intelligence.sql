CREATE TABLE `emails` (
	`id` char(26) NOT NULL,
	`message_id` varchar(255) NOT NULL,
	`in_reply_to` varchar(255),
	`thread_key` varchar(255) NOT NULL,
	`from_address` varchar(320) NOT NULL,
	`to_address` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`body_raw` text NOT NULL,
	`body_clean` text NOT NULL,
	`language` varchar(8),
	`received_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_analyses` (
	`id` char(26) NOT NULL,
	`email_id` char(26) NOT NULL,
	`analysis_json` json NOT NULL,
	`score` int NOT NULL,
	`temperature` varchar(8) NOT NULL,
	`score_breakdown` json NOT NULL,
	`model_version` varchar(96),
	`llm_call_id` char(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `email_analyses_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_email_analyses_temperature` CHECK(`temperature` IN ('panas','hangat','dingin'))
);
--> statement-breakpoint
CREATE TABLE `market_events` (
	`id` char(26) NOT NULL,
	`source` varchar(8) NOT NULL,
	`occurred_on` date NOT NULL,
	`region` varchar(120),
	`building_type` varchar(24),
	`project_scale` varchar(8),
	`installation_type` varchar(16),
	`outlet_count` int,
	`floors` int,
	`product_interest` json NOT NULL,
	`quotation_intent` boolean NOT NULL DEFAULT false,
	`reached_solution` boolean NOT NULL DEFAULT false,
	`routed_to_technical` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `market_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_market_events_source` CHECK(`source` IN ('chat','email')),
	CONSTRAINT `ck_market_events_scale` CHECK(`project_scale` IS NULL OR `project_scale` IN ('kecil','sedang','besar')),
	CONSTRAINT `ck_market_events_installation` CHECK(`installation_type` IS NULL OR `installation_type` IN ('air_bersih','pembuangan','keduanya'))
);
--> statement-breakpoint
ALTER TABLE `email_analyses` ADD CONSTRAINT `fk_email_analyses_email` FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_emails_message_id` ON `emails` (`message_id`);--> statement-breakpoint
CREATE INDEX `ix_emails_thread` ON `emails` (`thread_key`,`received_at`);--> statement-breakpoint
CREATE INDEX `ix_emails_received` ON `emails` (`received_at`);--> statement-breakpoint
CREATE INDEX `ix_email_analyses_email` ON `email_analyses` (`email_id`);--> statement-breakpoint
CREATE INDEX `ix_email_analyses_temperature` ON `email_analyses` (`temperature`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_market_events_day_region` ON `market_events` (`occurred_on`,`region`);--> statement-breakpoint
CREATE INDEX `ix_market_events_source_day` ON `market_events` (`source`,`occurred_on`);
