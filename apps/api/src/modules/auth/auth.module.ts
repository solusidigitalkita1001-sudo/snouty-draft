import { Module } from '@nestjs/common';
import { GuestSessionService } from './application/guest-session.service.js';
import { TokenService } from './application/token.service.js';
import {
  GUEST_SESSION_REPOSITORY,
  type GuestSessionRepository,
} from './domain/guest-session.repository.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository.js';
import { loadEnv } from '../../config/env.js';
import { passwordHasherProvider } from './infrastructure/argon2-password-hasher.js';
import { accessTokenServiceProvider } from './infrastructure/jwt-access-token.service.js';
import { guestSessionRepositoryProvider } from './infrastructure/mysql-guest-session.repository.js';
import { refreshTokenRepositoryProvider } from './infrastructure/mysql-refresh-token.repository.js';
import { GuestSessionMiddleware } from './presentation/guest-session.middleware.js';

const guestSessionServiceProvider = {
  provide: GuestSessionService,
  inject: [GUEST_SESSION_REPOSITORY],
  useFactory: (repository: GuestSessionRepository) =>
    new GuestSessionService(repository, loadEnv().GUEST_SESSION_TTL),
};

const tokenServiceProvider = {
  provide: TokenService,
  inject: [REFRESH_TOKEN_REPOSITORY],
  useFactory: (repository: RefreshTokenRepository) =>
    new TokenService(repository, loadEnv().JWT_REFRESH_TTL),
};

/**
 * Konteks identity, modul `auth` (docs/ARCHITECTURE.md §6).
 *
 * Masih sebagian: use case register/login menyusul di P3-05. Yang diekspor adalah port-nya, bukan implementasinya — modul
 * lain tidak perlu tahu KDF mana yang dipakai, dan menaikkan biaya KDF nanti tidak
 * boleh menyentuh satu pun pemanggil.
 */
@Module({
  providers: [
    passwordHasherProvider,
    accessTokenServiceProvider,
    refreshTokenRepositoryProvider,
    tokenServiceProvider,
    guestSessionRepositoryProvider,
    guestSessionServiceProvider,
    GuestSessionMiddleware,
  ],
  exports: [
    passwordHasherProvider,
    accessTokenServiceProvider,
    tokenServiceProvider,
    guestSessionServiceProvider,
    GuestSessionMiddleware,
  ],
})
export class AuthModule {}
