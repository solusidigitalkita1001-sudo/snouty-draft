-- Batas mm dinaikkan 3000 → 4000 (keputusan pemilik 2026-10-06): export ERP Pralon memuat fitting PE
-- 3150 mm (Bend All Flange 11¼°), dan batas 3000 mm dari rancangan awal terlalu sempit.
ALTER TABLE `product_sizes` DROP CHECK `ck_product_sizes_range`;
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ck_product_sizes_range` CHECK (
  (`size_unit` = 'in' AND `size_value_x1000` BETWEEN 1 AND 100000)
  OR (`size_unit` = 'mm' AND `size_value_x1000` BETWEEN 1 AND 4000000));
