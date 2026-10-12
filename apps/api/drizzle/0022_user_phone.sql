-- P16-53: nomor HP pengguna yang bisa dihubungi (permintaan pemilik 2026-10-12). Wajib untuk akun
-- baru di lapisan aplikasi; kolomnya NULL supaya akun lama tetap sah. Disimpan dinormalkan +62….
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) NULL AFTER `name`;
