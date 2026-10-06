-- Ukuran pipa membawa satuannya (docs/PIPE_SIZE_MM_EXTENSION.md §4). Export ERP Pralon menulis
-- HDPE, PVC seri ISO/SNI, dan fitting besar dalam milimeter; `110 mm` dan `4"` adalah dua ukuran
-- berbeda, bukan satu angka dengan dua label — tidak ada konversi di kode. Baris lama tetap inci.
ALTER TABLE `product_sizes` DROP CHECK `ck_product_sizes_positive`;
--> statement-breakpoint
ALTER TABLE `product_sizes` RENAME COLUMN `size_inches_x1000` TO `size_value_x1000`;
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD COLUMN `size_unit` varchar(2) NOT NULL DEFAULT 'in' AFTER `product_id`;
--> statement-breakpoint
ALTER TABLE `product_sizes` DROP PRIMARY KEY, ADD PRIMARY KEY (`product_id`, `size_unit`, `size_value_x1000`);
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ck_product_sizes_unit` CHECK (`size_unit` IN ('in','mm'));
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ck_product_sizes_range` CHECK (
  (`size_unit` = 'in' AND `size_value_x1000` BETWEEN 1 AND 100000)
  OR (`size_unit` = 'mm' AND `size_value_x1000` BETWEEN 1 AND 3000000));
--> statement-breakpoint
CREATE INDEX `ix_product_sizes_unit_value` ON `product_sizes` (`size_unit`, `size_value_x1000`);
