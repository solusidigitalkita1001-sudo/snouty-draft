-- P31-89: kolom `building_type` terlalu pendek untuk nama kasus terpanjang.
--
-- Nilainya bukan hanya jenis bangunan: bila pengguna tidak menyebut jenis bangunan, yang
-- tercatat adalah id kasusnya — dan `multistorey_building_water` panjangnya 26 huruf, dua
-- huruf lebih panjang dari kolomnya. MySQL menolak barisnya, pencatat menelan galatnya sebagai
-- peringatan, dan event pasar untuk gedung bertingkat hilang tanpa terlihat siapa pun.
--
-- 64 dipilih supaya id kasus terpanjang hari ini (26) dan yang akan datang muat tanpa
-- migration berikutnya.
ALTER TABLE `market_events` MODIFY COLUMN `building_type` varchar(64) NULL;
