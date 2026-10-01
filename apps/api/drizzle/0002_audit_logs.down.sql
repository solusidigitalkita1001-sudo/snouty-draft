-- Rollback untuk 0002_audit_logs.sql.
--
-- DROP TABLE sudah membuang indeksnya, jadi tidak ada DROP INDEX terpisah.
--
-- Perlu disadari saat benar-benar dijalankan di server: menurunkan migration ini
-- MENGHAPUS jejak audit, dan retensinya 24 bulan (docs/PRIVACY.md §6). Rollback
-- tetap disertakan karena setiap migration harus punya jalur mundur, tetapi
-- menjalankannya di produksi adalah keputusan tersendiri, bukan langkah rutin.

DROP TABLE IF EXISTS `audit_logs`;
