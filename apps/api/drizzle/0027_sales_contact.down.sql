-- Rollback untuk 0027: permintaan dihubungi hilang; consent SALES_CONTACT dihapus sebelum batasan dipulihkan.
DROP TABLE `sales_requests`;
--> statement-breakpoint
DELETE FROM `consents` WHERE `kind` = 'SALES_CONTACT';
--> statement-breakpoint
ALTER TABLE `consents` DROP CHECK `ck_consents_kind`;
--> statement-breakpoint
ALTER TABLE `consents`
  ADD CONSTRAINT `ck_consents_kind` CHECK (`kind` IN ('LOCATION','ANALYTICS_STORAGE'));
