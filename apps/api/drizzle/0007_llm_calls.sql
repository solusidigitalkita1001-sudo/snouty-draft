CREATE TABLE `llm_calls` (
	`id` char(26) NOT NULL,
	`correlation_id` varchar(64),
	`task` varchar(32) NOT NULL,
	`tier` varchar(12) NOT NULL,
	`model` varchar(96) NOT NULL,
	`prompt_tokens` int NOT NULL DEFAULT 0,
	`completion_tokens` int NOT NULL DEFAULT 0,
	`cost_usd` decimal(10,6) NOT NULL DEFAULT '0',
	`latency_ms` int NOT NULL DEFAULT 0,
	`outcome` varchar(20) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `llm_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_llm_calls_outcome` CHECK(`outcome` IN ('success','validation_failed','error'))
);
--> statement-breakpoint
CREATE INDEX `ix_llm_calls_created` ON `llm_calls` (`created_at`);--> statement-breakpoint
CREATE INDEX `ix_llm_calls_task_created` ON `llm_calls` (`task`,`created_at`);
