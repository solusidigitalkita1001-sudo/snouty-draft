import { Module } from '@nestjs/common';
import { RateLimiter } from '../../shared/rate-limit/rate-limiter.js';
import { RedisService } from '../../shared/redis/redis.service.js';
import { AuthService } from './application/auth.service.js';
import { GuestSessionService } from './application/guest-session.service.js';
import { TokenService } from './application/token.service.js';
import {
  GUEST_SESSION_REPOSITORY,
  type GuestSessionRepository,
} from './domain/guest-session.repository.js';
import {
  GUEST_ACCOUNT_LINKER,
  type GuestAccountLinker,
} from './domain/guest-account-linker.port.js';
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
import { guestAccountLinkerProvider } from './infrastructure/mysql-guest-account-linker.js';
import { guestSessionRepositoryProvider } from './infrastructure/mysql-guest-session.repository.js';
import { userRepositoryProvider } from './infrastructure/mysql-user.repository.js';
import { refreshTokenRepositoryProvider } from './infrastructure/mysql-refresh-token.repository.js';
import { AccessTokenMiddleware } from './presentation/access-token.middleware.js';
import { AuthController } from './presentation/auth.controller.js';
import { GuestSessionMiddleware } from './presentation/guest-session.middleware.js';

const guestSessionServiceProvider = {
  provide: GuestSessionService,
  inject: [GUEST_SESSION_REPOSITORY],
  useFactory: (repository: GuestSessionRepository) =>
    new GuestSessionService(repository, loadEnv().GUEST_SESSION_TTL),
};

const authServiceProvider = {
  provide: AuthService,
  inject: [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    TokenService,
    ACCESS_TOKEN_SERVICE,
    GUEST_ACCOUNT_LINKER,
  ],
  useFactory: (
    users: UserRepository,
    hasher: PasswordHasher,
    tokens: TokenService,
    accessTokens: AccessTokenService,
    linker: GuestAccountLinker,
  ) => new AuthService(users, hasher, tokens, accessTokens, linker),
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
const rateLimiterProvider = {
  provide: RateLimiter,
  inject: [RedisService],
  useFactory: (redis: RedisService) => new RateLimiter(redis),
};

@Module({
  controllers: [AuthController],
  providers: [
    rateLimiterProvider,
    passwordHasherProvider,
    accessTokenServiceProvider,
    refreshTokenRepositoryProvider,
    tokenServiceProvider,
    guestSessionRepositoryProvider,
    guestSessionServiceProvider,
    userRepositoryProvider,
    guestAccountLinkerProvider,
    authServiceProvider,
    GuestSessionMiddleware,
    AccessTokenMiddleware,
  ],
  exports: [
    passwordHasherProvider,
    accessTokenServiceProvider,
    tokenServiceProvider,
    guestSessionServiceProvider,
    authServiceProvider,
    GuestSessionMiddleware,
    AccessTokenMiddleware,
  ],
})
export class AuthModule {}
