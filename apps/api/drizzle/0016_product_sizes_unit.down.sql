-- Rollback untuk 0016_product_sizes_unit.sql. Hanya aman bila TIDAK ada baris mm: skema lama tidak
-- punya tempat untuknya, dan menghapusnya diam-diam berarti menghilangkan data katalog. Maka turun
-- GAGAL dengan pesan jelas selama baris mm masih ada — arsipkan/hapus versi katalognya lebih dulu.
DROP PROCEDURE IF EXISTS `snouty_product_sizes_down_guard`;
--> statement-breakpoint
CREATE PROCEDURE `snouty_product_sizes_down_guard`()
BEGIN
  DECLARE mm_rows INT;
  SELECT COUNT(*) INTO mm_rows FROM `product_sizes` WHERE `size_unit` = 'mm';
  IF mm_rows > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Migrasi turun 0016 ditolak: product_sizes masih memuat baris mm. Hapus/arsipkan versi katalog mm dulu; data tidak disentuh.';
  END IF;
END;
--> statement-breakpoint
CALL `snouty_product_sizes_down_guard`();
--> statement-breakpoint
DROP PROCEDURE `snouty_product_sizes_down_guard`;
--> statement-breakpoint
DROP INDEX `ix_product_sizes_unit_value` ON `product_sizes`;
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP CHECK `ck_product_sizes_range`;
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP CHECK `ck_product_sizes_unit`;
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP PRIMARY KEY, ADD PRIMARY KEY (`product_id`, `size_value_x1000`);
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP COLUMN `size_unit`;
--> statement-breakpoint
ALTER TABLE `product_sizes` RENAME COLUMN `size_value_x1000` TO `size_inches_x1000`;
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ck_product_sizes_positive` CHECK (`size_inches_x1000` > 0);
