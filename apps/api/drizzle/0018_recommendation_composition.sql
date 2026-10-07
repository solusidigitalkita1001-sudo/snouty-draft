-- Fase 14 §28 (P14-06): bagian tetap jawaban teknis — data diketahui, asumsi parameter, perhitungan,
-- opsi ukuran, kesiapan per keluaran, data yang masih dibutuhkan — disimpan bersama rekomendasi
-- supaya laporan dan riwayat menampilkan jawaban yang sama dengan yang dilihat saat analisis.
-- NULL untuk rekomendasi bangunan/irigasi dan baris sebelum 0018.
ALTER TABLE `recommendations` ADD COLUMN `composition` JSON NULL AFTER `highlights`;
