import { Module } from '@nestjs/common';
import { passwordHasherProvider } from './infrastructure/argon2-password-hasher.js';

/**
 * Konteks identity, modul `auth` (docs/ARCHITECTURE.md §6).
 *
 * Masih sebagian: token, sesi tamu, dan use case register/login menyusul di
 * P3-03 sampai P3-05. Yang diekspor adalah port-nya, bukan implementasinya — modul
 * lain tidak perlu tahu KDF mana yang dipakai, dan menaikkan biaya KDF nanti tidak
 * boleh menyentuh satu pun pemanggil.
 */
@Module({
  providers: [passwordHasherProvider],
  exports: [passwordHasherProvider],
})
export class AuthModule {}
