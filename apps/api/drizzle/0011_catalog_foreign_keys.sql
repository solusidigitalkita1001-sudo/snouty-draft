-- P1-01b — foreign key DI DALAM konteks katalog (docs/DATABASE.md §5).
--
-- Ketahuan saat menulis skema identity: tujuh tabel katalog tidak punya satu pun FK,
-- padahal aturannya mewajibkan FK di dalam satu konteks. Akibatnya baris anak yatim
-- mungkin terjadi — dan katalog yatim adalah data yang tidak bisa dijelaskan asalnya.
--
-- CASCADE karena anak-anak ini tidak punya arti tanpa induknya: ukuran tanpa produk
-- bukan apa-apa, dan membiarkannya sebagai RESTRICT berarti versi katalog lama tidak
-- pernah bisa dibersihkan.
--
-- Catatan operasional: MySQL menolak menambahkan FK bila baris yatim sudah ada. Pada
-- database yang sudah berisi, jalankan dulu pemeriksaan di scripts/check-catalog-orphans.mjs.
ALTER TABLE `products` ADD CONSTRAINT `fk_products_version` FOREIGN KEY (`catalog_version_id`) REFERENCES `catalog_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_sizes` ADD CONSTRAINT `fk_product_sizes_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_specs` ADD CONSTRAINT `fk_product_specs_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_documents` ADD CONSTRAINT `fk_product_documents_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `fk_product_images_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_compatibility` ADD CONSTRAINT `fk_product_compatibility_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_compatibility` ADD CONSTRAINT `fk_product_compatibility_compatible` FOREIGN KEY (`compatible_product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;
