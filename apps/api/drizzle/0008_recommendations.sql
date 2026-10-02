CREATE TABLE `recommendations` (
	`id` char(26) NOT NULL,
	`conversation_id` char(26) NOT NULL,
	`snapshot_id` char(26) NOT NULL,
	`catalog_version_id` char(26) NOT NULL,
	`headline` varchar(300) NOT NULL,
	`body` text NOT NULL,
	`stats` json NOT NULL,
	`system_lines` json NOT NULL,
	`products` json NOT NULL,
	`bom` json NOT NULL,
	`assumptions` json NOT NULL,
	`overall_provenance` varchar(12) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_recommendations_provenance` CHECK(`overall_provenance` IN ('VERIFIED','ASSUMED','ESTIMATED','UNAVAILABLE'))
);
--> statement-breakpoint
CREATE TABLE `calculation_traces` (
	`id` char(26) NOT NULL,
	`recommendation_id` char(26) NOT NULL,
	`rule_id` varchar(16) NOT NULL,
	`rule_version` char(8) NOT NULL,
	`inputs` json NOT NULL,
	`output` json NOT NULL,
	`provenance` varchar(12) NOT NULL,
	`explanation` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `calculation_traces_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_traces_provenance` CHECK(`provenance` IN ('VERIFIED','ASSUMED','ESTIMATED','UNAVAILABLE'))
);
--> statement-breakpoint
ALTER TABLE `recommendations` ADD CONSTRAINT `fk_recommendations_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calculation_traces` ADD CONSTRAINT `fk_traces_recommendation` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_recommendations_conversation` ON `recommendations` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_traces_recommendation` ON `calculation_traces` (`recommendation_id`);--> statement-breakpoint
CREATE INDEX `ix_traces_rule` ON `calculation_traces` (`rule_id`,`rule_version`);
