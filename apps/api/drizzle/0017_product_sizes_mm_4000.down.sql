-- Rollback untuk 0017: mengembalikan batas 3000 mm. Menambah CHECK yang dilanggar baris 3000–4000 mm
-- GAGAL sendiri di MySQL (ER_CHECK_CONSTRAINT_VIOLATED) tanpa menyentuh data — itu perilaku yang
-- diinginkan: turun tidak boleh menghapus produk diam-diam.
ALTER TABLE `product_sizes` DROP CHECK `ck_product_sizes_range`;
--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `ck_product_sizes_range` CHECK (
  (`size_unit` = 'in' AND `size_value_x1000` BETWEEN 1 AND 100000)
  OR (`size_unit` = 'mm' AND `size_value_x1000` BETWEEN 1 AND 3000000));
