CREATE TABLE `onboarding_states` (
	`subject_kind` varchar(8) NOT NULL,
	`subject_id` char(26) NOT NULL,
	`state` varchar(8) NOT NULL,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `onboarding_states_subject_kind_subject_id_pk` PRIMARY KEY(`subject_kind`,`subject_id`),
	CONSTRAINT `ck_onboarding_states_subject` CHECK(`subject_kind` IN ('user','guest')),
	CONSTRAINT `ck_onboarding_states_state` CHECK(`state` IN ('done','guest','skip'))
);
