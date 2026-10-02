import { Module } from '@nestjs/common';
import { TokenService } from './application/token.service.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository.js';
import { loadEnv } from '../../config/env.js';
import { passwordHasherProvider } from './infrastructure/argon2-password-hasher.js';
import { accessTokenServiceProvider } from './infrastructure/jwt-access-token.service.js';
import { refreshTokenRepositoryProvider } from './infrastructure/mysql-refresh-token.repository.js';

const tokenServiceProvider = {
  provide: TokenService,
  inject: [REFRESH_TOKEN_REPOSITORY],
  useFactory: (repository: RefreshTokenRepository) =>
    new TokenService(repository, loadEnv().JWT_REFRESH_TTL),
};

/**
 * Konteks identity, modul `auth` (docs/ARCHITECTURE.md §6).
 *
 * Masih sebagian: sesi tamu dan use case register/login menyusul di P3-04–P3-05. Yang diekspor adalah port-nya, bukan implementasinya — modul
 * lain tidak perlu tahu KDF mana yang dipakai, dan menaikkan biaya KDF nanti tidak
 * boleh menyentuh satu pun pemanggil.
 */
@Module({
  providers: [
    passwordHasherProvider,
    accessTokenServiceProvider,
    refreshTokenRepositoryProvider,
    tokenServiceProvider,
  ],
  exports: [passwordHasherProvider, accessTokenServiceProvider, tokenServiceProvider],
})
export class AuthModule {}
