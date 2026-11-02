-- P32-52/P32-53: pekerjaan di instalasi yang sudah terpasang — pipa lama yang tercatat dan hasil
-- pemeriksaan kapasitasnya (ENG-901) — disimpan bersama rekomendasi, supaya pertanyaan "pipa lama
-- saya masih bisa dipakai?" dijawab dari hitungan yang sama dengan layar solusi. NULL untuk
-- pekerjaan bangun baru dan baris sebelum 0036.
ALTER TABLE `recommendations` ADD COLUMN `existing_pipe` JSON NULL AFTER `tank_stand`;
