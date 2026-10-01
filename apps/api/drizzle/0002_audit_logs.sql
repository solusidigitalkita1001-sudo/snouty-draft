CREATE TABLE `audit_logs` (
	`id` char(26) NOT NULL,
	`actor_id` char(26) NOT NULL,
	`actor_role` varchar(32) NOT NULL,
	`action` varchar(64) NOT NULL,
	`entity_type` varchar(48) NOT NULL,
	`entity_id` char(26) NOT NULL,
	`before_json` json,
	`after_json` json,
	`correlation_id` varchar(64),
	`ip` varchar(45),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_audit_logs_actor_created` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_audit_logs_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `ix_audit_logs_action_created` ON `audit_logs` (`action`,`created_at`);