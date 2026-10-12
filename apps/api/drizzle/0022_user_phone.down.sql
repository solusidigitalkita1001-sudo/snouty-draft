-- Rollback untuk 0022: nomor HP pengguna hilang.
ALTER TABLE `users` DROP COLUMN `phone`;
