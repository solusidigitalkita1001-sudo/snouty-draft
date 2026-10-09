/**
 * Token akun kedaluwarsa di rute publik → 401 (web memperbarui sesi), bukan tamu diam-diam.
 */
import { describe, expect, it, vi } from 'vitest';
import { ExpiredAccessTokenError } from '../domain/auth.errors.js';
import { AccessTokenMiddleware } from './access-token.middleware.js';
import { RejectStaleTokenMiddleware } from './reject-stale-token.middleware.js';

const tokens = {
  verify: vi.fn(async (t: string) => (t === 'sah' ? { userId: 'U', roles: [] } : null)),
};

async function through(authorization?: string) {
  const request = { headers: authorization ? { authorization } : {} } as never;
  await new AccessTokenMiddleware(tokens as never).use(request, {} as never, () => undefined);
  const next = vi.fn();
  let error: unknown = null;
  try {
    new RejectStaleTokenMiddleware().use(request, {} as never, next);
  } catch (e) {
    error = e;
  }
  return { next, error, request: request as { authTokenRejected?: boolean } };
}

describe('RejectStaleTokenMiddleware', () => {
  it('token kedaluwarsa/tidak sah → 401 UNAUTHENTICATED', async () => {
    const { error, next, request } = await through('Bearer kedaluwarsa');
    expect(request.authTokenRejected).toBe(true);
    expect(error).toBeInstanceOf(ExpiredAccessTokenError);
    expect((error as { code: string }).code).toBe('UNAUTHENTICATED');
    expect(next).not.toHaveBeenCalled();
  });

  it('tamu tanpa token dan akun dengan token sah lewat', async () => {
    for (const header of [undefined, 'Bearer sah']) {
      const { error, next } = await through(header);
      expect(error).toBeNull();
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
