-- Rollback untuk 0024: pilihan dudukan toren hilang; kartu Tinggi toren tidak tampil.
ALTER TABLE `recommendations` DROP COLUMN `tank_stand`;
