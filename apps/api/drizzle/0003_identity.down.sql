-- Rollback untuk 0003_identity.sql.
--
-- Urutan dibalik dari urutan create, dan di sini urutannya MENGIKAT: tabel yang
-- dirujuk foreign key tidak bisa di-drop lebih dulu. `users` karena itu terakhir.
--
-- Perlu disadari saat benar-benar dijalankan di server: menurunkan migration ini
-- menghapus akun, peran, sesi, dan **catatan persetujuan**. Baris consent adalah
-- bukti kepatuhan dengan retensi tersendiri (docs/PRIVACY.md §6), jadi
-- menjalankannya di produksi adalah keputusan hukum, bukan langkah teknis rutin.

DROP TABLE IF EXISTS `consents`;
--> statement-breakpoint
DROP TABLE IF EXISTS `refresh_tokens`;
--> statement-breakpoint
DROP TABLE IF EXISTS `user_roles`;
--> statement-breakpoint
DROP TABLE IF EXISTS `guest_sessions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `users`;
