/**
 * Kuota pemulihan sesi (P29-04).
 *
 * Satu kantor Pralon duduk di balik satu alamat IP. Sebelum ini `POST /auth/refresh` berbagi
 * kuota dengan login — sepuluh per seperempat jam untuk seluruh kantor — dan setiap muat
 * halaman menembaknya sekali, jadi orang kesembilan melihat layar "masuk dengan akun yang
 * punya akses" tanpa pernah ditolak kata sandinya.
 */
import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController, REFRESH_COOKIE } from './auth.controller.js';
import {
  AUTH_IP_LIMIT,
  AUTH_REFRESH_FAILURE_IP_LIMIT,
  AUTH_REFRESH_IP_LIMIT,
  type RateLimit,
} from '../../policy/rate-limits.js';
import { RateLimitedError } from '../../../shared/http/api-errors.js';
import { InvalidRefreshTokenError } from '../domain/auth.errors.js';

interface Consumed {
  readonly dimension: string;
  readonly limit: RateLimit;
}

function limiterFake(exhausted: readonly string[] = []) {
  const consumed: Consumed[] = [];
  return {
    consumed,
    async consume(dimension: string, _subject: string, limit: RateLimit) {
      consumed.push({ dimension, limit });
      return exhausted.includes(dimension)
        ? { allowed: false, remaining: 0, retryAfterSec: 60 }
        : { allowed: true, remaining: limit.max - 1, retryAfterSec: 0 };
    },
  };
}

const SESSION = {
  userId: '01J0000000000000000000000X',
  name: 'Sales Dev',
  tier: 'registered' as const,
  roles: [] as string[],
  accessToken: 'token-akses',
  refresh: { token: 'token-refresh', expiresAt: new Date(Date.now() + 86_400_000) },
};

function authFake(outcome: 'ok' | 'invalid' = 'ok') {
  return {
    async refresh() {
      if (outcome === 'invalid') throw new InvalidRefreshTokenError('unknown');
      return SESSION;
    },
  };
}

function requestWithCookie(cookie: string | undefined): Request {
  return { ip: '203.0.113.7', headers: cookie ? { cookie } : {} } as unknown as Request;
}

const responseFake = () => ({ cookie() {}, clearCookie() {} }) as unknown as Response;

function controllerWith(auth: unknown, limiter: unknown): AuthController {
  return new AuthController(
    auth as ConstructorParameters<typeof AuthController>[0],
    limiter as ConstructorParameters<typeof AuthController>[1],
  );
}

describe('AuthController · pemulihan sesi', () => {
  it('memakai kuota refresh sendiri, bukan kuota login', async () => {
    const limiter = limiterFake();
    const controller = controllerWith(authFake(), limiter);

    await controller.refresh(requestWithCookie(`${REFRESH_COOKIE}=rahasia`), responseFake());

    expect(limiter.consumed).toEqual([{ dimension: 'auth:refresh', limit: AUTH_REFRESH_IP_LIMIT }]);
  });

  it('pemulihan yang berhasil tidak menyentuh kuota kegagalan', async () => {
    const limiter = limiterFake();
    const controller = controllerWith(authFake(), limiter);

    await controller.refresh(requestWithCookie(`${REFRESH_COOKIE}=rahasia`), responseFake());

    expect(limiter.consumed.map((entry) => entry.dimension)).not.toContain('auth:refresh-failed');
  });

  it('cookie yang ditolak dihitung pada kuota kegagalan yang ketat', async () => {
    const limiter = limiterFake();
    const controller = controllerWith(authFake('invalid'), limiter);

    await expect(
      controller.refresh(requestWithCookie(`${REFRESH_COOKIE}=salah`), responseFake()),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(limiter.consumed).toEqual([
      { dimension: 'auth:refresh', limit: AUTH_REFRESH_IP_LIMIT },
      { dimension: 'auth:refresh-failed', limit: AUTH_REFRESH_FAILURE_IP_LIMIT },
    ]);
  });

  it('tanpa cookie sama sekali juga dihitung sebagai kegagalan', async () => {
    const limiter = limiterFake();
    const controller = controllerWith(authFake(), limiter);

    await expect(
      controller.refresh(requestWithCookie(undefined), responseFake()),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(limiter.consumed.map((entry) => entry.dimension)).toEqual([
      'auth:refresh',
      'auth:refresh-failed',
    ]);
  });

  it('kegagalan yang bertubi-tubi berakhir 429, bukan 401', async () => {
    const limiter = limiterFake(['auth:refresh-failed']);
    const controller = controllerWith(authFake('invalid'), limiter);

    await expect(
      controller.refresh(requestWithCookie(`${REFRESH_COOKIE}=salah`), responseFake()),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('kuota refresh jauh lebih longgar daripada kuota login', () => {
    expect(AUTH_REFRESH_IP_LIMIT.max).toBeGreaterThan(AUTH_IP_LIMIT.max * 10);
    expect(AUTH_REFRESH_FAILURE_IP_LIMIT.max).toBeLessThan(AUTH_REFRESH_IP_LIMIT.max);
  });
});

describe('AuthController · gangguan bukan tebakan', () => {
  it('kegagalan selain cookie yang ditolak tidak memakan kuota kegagalan', async () => {
    const limiter = limiterFake();
    const meledak = {
      refresh() {
        return Promise.reject(new Error('database sedang mati'));
      },
    };
    const controller = controllerWith(meledak, limiter);

    await expect(
      controller.refresh(requestWithCookie(`${REFRESH_COOKIE}=rahasia`), responseFake()),
    ).rejects.toThrow('database sedang mati');

    expect(limiter.consumed.map((entry) => entry.dimension)).toEqual(['auth:refresh']);
  });
});
