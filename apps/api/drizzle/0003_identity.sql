CREATE TABLE `consents` (
	`id` char(26) NOT NULL,
	`subject_id` char(26) NOT NULL,
	`subject_kind` varchar(8) NOT NULL,
	`kind` varchar(24) NOT NULL,
	`granted` tinyint NOT NULL,
	`policy_version` varchar(32) NOT NULL,
	`granted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	CONSTRAINT `consents_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_consents_subject_kind` CHECK(`subject_kind` IN ('user','guest')),
	CONSTRAINT `ck_consents_kind` CHECK(`kind` IN ('LOCATION','ANALYTICS_STORAGE')),
	CONSTRAINT `ck_consents_revoked_after_granted` CHECK((`revoked_at` IS NULL) OR (`revoked_at` >= `granted_at`)),
	CONSTRAINT `ck_consents_revoke_only_granted` CHECK((`revoked_at` IS NULL) OR (`granted` = 1))
);
--> statement-breakpoint
CREATE TABLE `guest_sessions` (
	`id` char(26) NOT NULL,
	`linked_user_id` char(26),
	`linked_at` datetime(3),
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3),
	CONSTRAINT `guest_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ck_guest_sessions_link_pair` CHECK((`linked_user_id` IS NULL) = (`linked_at` IS NULL))
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`family_id` char(26) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_refresh_tokens_hash` UNIQUE(`token_hash`),
	CONSTRAINT `ck_refresh_tokens_expiry` CHECK(`expires_at` > `created_at`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` char(26) NOT NULL,
	`role` varchar(32) NOT NULL,
	`granted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`granted_by` char(26),
	CONSTRAINT `user_roles_user_id_role_pk` PRIMARY KEY(`user_id`,`role`),
	CONSTRAINT `ck_user_roles_role` CHECK(`role` IN ('sales_reviewer','technical_team','catalog_admin','domain_expert','admin'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(26) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL,
	`tier` varchar(16) NOT NULL DEFAULT 'registered',
	`theme_preference` varchar(8) NOT NULL DEFAULT 'system',
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_seen_at` datetime(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_users_email` UNIQUE(`email`),
	CONSTRAINT `ck_users_tier` CHECK(`tier` IN ('registered','advanced')),
	CONSTRAINT `ck_users_status` CHECK(`status` IN ('active','disabled')),
	CONSTRAINT `ck_users_theme_preference` CHECK(`theme_preference` IN ('light','dark','system'))
);
--> statement-breakpoint
ALTER TABLE `guest_sessions` ADD CONSTRAINT `fk_guest_sessions_linked_user` FOREIGN KEY (`linked_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_consents_subject` ON `consents` (`subject_kind`,`subject_id`,`kind`);--> statement-breakpoint
CREATE INDEX `ix_guest_sessions_expires` ON `guest_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ix_guest_sessions_linked_user` ON `guest_sessions` (`linked_user_id`);--> statement-breakpoint
CREATE INDEX `ix_refresh_tokens_user` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_refresh_tokens_family` ON `refresh_tokens` (`family_id`);--> statement-breakpoint
CREATE INDEX `ix_refresh_tokens_expires` ON `refresh_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ix_user_roles_role` ON `user_roles` (`role`);--> statement-breakpoint
CREATE INDEX `ix_users_status` ON `users` (`status`);