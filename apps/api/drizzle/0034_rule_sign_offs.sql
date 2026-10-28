-- P31-82: tanda tangan ahli pipa Pralon atas aturan hitung.
--
-- Sampai hari ini `validationStatus` hanya ada di dalam kode paket engineering, dan nilainya
-- `REQUIRES_DOMAIN_VALIDATION` untuk seluruh aturan — jadi tidak ada satu pun angka yang pernah
-- tampil sebagai terverifikasi, dan tidak ada jalan bagi siapa pun untuk mengubahnya selain
-- menyunting kode. Tanda tangan adalah fakta tentang orang dan waktu, bukan tentang formula,
-- jadi ia tinggal di basis data; paket engineering tetap murni dan tetap bisa diputar ulang.
--
-- Kunci utamanya aturan + VERSI: menaikkan versi sebuah aturan berarti formulanya berubah, dan
-- tanda tangan atas formula lama tidak boleh ikut terbawa. Laporan lama tetap menunjuk versi
-- yang dipakai saat itu, beserta status yang berlaku saat itu.
--
-- Nama penanda tangan dibaca lewat join ke `users`, bukan disalin: akun internal
-- dinonaktifkan dan tidak pernah dihapus (docs/BACKOFFICE.md §5), jadi namanya selalu ada.
CREATE TABLE `rule_sign_offs` (
  `rule_id` varchar(16) NOT NULL,
  `rule_version` int NOT NULL,
  `decision` varchar(16) NOT NULL,
  `decided_by` char(26) NOT NULL,
  `note` varchar(500) NULL,
  `decided_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`rule_id`, `rule_version`),
  CONSTRAINT `ck_rule_sign_offs_decision` CHECK (`decision` IN ('approved', 'rejected'))
);
