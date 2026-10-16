-- P22-04 (masukan pengguna rumah subsidi, 2026-10-16): pilihan dudukan toren — dak atap atau tiang
-- toren — dengan tekanan di titik air tertinggi tiap pilihan (ENG-711), disimpan bersama rekomendasi
-- supaya layar, laporan, dan jawaban chat membaca angka yang sama. NULL untuk sumber selain toren
-- atap, rekomendasi non-bangunan, dan baris sebelum 0024.
ALTER TABLE `recommendations` ADD COLUMN `tank_stand` JSON NULL AFTER `needs`;
