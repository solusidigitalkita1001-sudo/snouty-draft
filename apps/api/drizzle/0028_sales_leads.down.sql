-- Rollback untuk 0028: penugasan sales hilang; peran `sales` dicabut sebelum batasan dipulihkan.
DROP TABLE `sales_leads`;
--> statement-breakpoint
DELETE FROM `user_roles` WHERE `role` = 'sales';
--> statement-breakpoint
ALTER TABLE `user_roles` DROP CHECK `ck_user_roles_role`;
--> statement-breakpoint
ALTER TABLE `user_roles`
  ADD CONSTRAINT `ck_user_roles_role` CHECK (`role` IN ('sales_reviewer','technical_team','catalog_admin','domain_expert','admin'));
