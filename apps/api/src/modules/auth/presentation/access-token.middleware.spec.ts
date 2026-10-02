/**
 * P3-07 — middleware mengisi, tidak pernah menolak.
 */
import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type {
  AccessTokenClaims,
  AccessTokenService,
} from '../infrastructure/jwt-access-token.service.js';
import type { WithInternalActor } from '../../../shared/http/internal-role.guard.js';
import { AccessTokenMiddleware, type WithAuthUser } from './access-token.middleware.js';

const CLAIMS: AccessTokenClaims = {
  userId: 'U'.padEnd(26, '0'),
  tier: 'registered',
  roles: ['catalog_admin'],
};

function run(authorization?: string, valid = true) {
  const fake: AccessTokenService = {
    sign: async () => 'tidak-dipakai',
    verify: async (token) => (valid && token === 'token-sah' ? CLAIMS : null),
  };
  const middleware = new AccessTokenMiddleware(fake);
  const request = { headers: { authorization } } as Request & WithAuthUser & WithInternalActor;
  let nexted = false;
  return middleware
    .use(
      request,
      {} as Response,
      (() => {
        nexted = true;
      }) as NextFunction,
    )
    .then(() => ({ request, nexted }));
}

describe('AccessTokenMiddleware', () => {
  it('mengisi authUser dan internalActor dari token yang sah', async () => {
    const { request } = await run('Bearer token-sah');

    expect(request.authUser).toEqual(CLAIMS);
    expect(request.internalActor).toEqual({ id: CLAIMS.userId, roles: ['catalog_admin'] });
  });

  it('meloloskan permintaan tanpa header sebagai anonim — guard yang memutuskan', async () => {
    const { request, nexted } = await run(undefined);

    expect(nexted).toBe(true);
    expect(request.authUser).toBeUndefined();
    expect(request.internalActor).toBeUndefined();
  });

  it('memperlakukan token tidak sah sebagai anonim, bukan sebagai galat', async () => {
    const { request, nexted } = await run('Bearer token-palsu');

    expect(nexted).toBe(true);
    expect(request.internalActor).toBeUndefined();
  });

  it('mengabaikan skema selain Bearer', async () => {
    const { request } = await run('Basic dXNlcjpwYXNz');

    expect(request.internalActor).toBeUndefined();
  });
});
