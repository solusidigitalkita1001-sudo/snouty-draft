import { Module } from '@nestjs/common';
import { AuthService } from './application/auth.service.js';
import { GuestSessionService } from './application/guest-session.service.js';
import { TokenService } from './application/token.service.js';
import {
  GUEST_SESSION_REPOSITORY,
  type GuestSessionRepository,
} from './domain/guest-session.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from './domain/password-hasher.port.js';
import { USER_REPOSITORY, type UserRepository } from './domain/user.repository.js';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository.js';
import { loadEnv } from '../../config/env.js';
import { passwordHasherProvider } from './infrastructure/argon2-password-hasher.js';
import { accessTokenServiceProvider } from './infrastructure/jwt-access-token.service.js';
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from './infrastructure/jwt-access-token.service.js';
import { guestSessionRepositoryProvider } from './infrastructure/mysql-guest-session.repository.js';
import { userRepositoryProvider } from './infrastructure/mysql-user.repository.js';
import { refreshTokenRepositoryProvider } from './infrastructure/mysql-refresh-token.repository.js';
import { GuestSessionMiddleware } from './presentation/guest-session.middleware.js';

const guestSessionServiceProvider = {
  provide: GuestSessionService,
  inject: [GUEST_SESSION_REPOSITORY],
  useFactory: (repository: GuestSessionRepository) =>
    new GuestSessionService(repository, loadEnv().GUEST_SESSION_TTL),
};

const authServiceProvider = {
  provide: AuthService,
  inject: [USER_REPOSITORY, PASSWORD_HASHER, TokenService, ACCESS_TOKEN_SERVICE],
  useFactory: (
    users: UserRepository,
    hasher: PasswordHasher,
    tokens: TokenService,
    accessTokens: AccessTokenService,
  ) => new AuthService(users, hasher, tokens, accessTokens),
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
 * Controller `/auth/*` menyusul di P3-11 bersama guard autentikasinya. Yang diekspor adalah port-nya, bukan implementasinya — modul
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
    userRepositoryProvider,
    authServiceProvider,
    GuestSessionMiddleware,
  ],
  exports: [
    passwordHasherProvider,
    accessTokenServiceProvider,
    tokenServiceProvider,
    guestSessionServiceProvider,
    authServiceProvider,
    GuestSessionMiddleware,
  ],
})
export class AuthModule {}
