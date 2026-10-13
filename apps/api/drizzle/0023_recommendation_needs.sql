-- P17-04 (DD-01 #1): kebutuhan bergambar di Ringkasan — bangunan, alat per lantai, sumber air, pompa,
-- pembuangan — dari hasil engine, disimpan bersama rekomendasi supaya laporan dan riwayat menampilkan
-- gambar yang sama. NULL untuk rekomendasi non-bangunan dan baris sebelum 0023.
ALTER TABLE `recommendations` ADD COLUMN `needs` JSON NULL AFTER `system_lines`;
