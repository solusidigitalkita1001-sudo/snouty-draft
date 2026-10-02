/**
 * Middleware sesi tamu: cookie yang benar dikirim, dan pembaca cookie-nya sendiri.
 */
import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type { GuestSessionService } from '../application/guest-session.service.js';
import {
  GUEST_COOKIE,
  GuestSessionMiddleware,
  readCookie,
  type WithGuestSession,
} from './guest-session.middleware.js';

const SESSION_ID = '01JB0000000000000000000000';

function run(cookieHeader?: string) {
  const captured: { name?: string; value?: string; options?: Record<string, unknown> } = {};
  const fake = {
    ensure: async (claimed: string | undefined) => ({
      id: claimed === SESSION_ID ? SESSION_ID : '01JB1111111111111111111111',
      expiresAt: new Date(Date.now() + 1_000_000),
      setCookie: true,
    }),
  };
  const middleware = new GuestSessionMiddleware(fake as unknown as GuestSessionService);
  const request = { headers: { cookie: cookieHeader } } as Request & WithGuestSession;
  const response = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      captured.name = name;
      captured.value = value;
      captured.options = options;
    },
  } as unknown as Response;

  let nexted = false;
  const next: NextFunction = () => {
    nexted = true;
  };
  return middleware.use(request, response, next).then(() => ({ captured, request, nexted }));
}

describe('GuestSessionMiddleware', () => {
  it('menaruh id sesi pada request dan mengirim cookie httpOnly', async () => {
    const { captured, request, nexted } = await run(undefined);

    expect(nexted).toBe(true);
    expect(request.guestSessionId).toBeDefined();
    expect(captured.name).toBe(GUEST_COOKIE);
    expect(captured.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });

  it('meneruskan id dari cookie yang ada ke service', async () => {
    const { request } = await run(`${GUEST_COOKIE}=${SESSION_ID}`);

    expect(request.guestSessionId).toBe(SESSION_ID);
  });
});

describe('readCookie', () => {
  it('membaca satu nama di antara banyak cookie', () => {
    expect(readCookie(`a=1; ${GUEST_COOKIE}=${SESSION_ID}; b=2`, GUEST_COOKIE)).toBe(SESSION_ID);
  });

  it('tidak tertipu nama cookie yang hanya berakhiran sama', () => {
    expect(readCookie(`x_${GUEST_COOKIE}=salah`, GUEST_COOKIE)).toBeUndefined();
  });

  it('mengembalikan undefined untuk header kosong', () => {
    expect(readCookie(undefined, GUEST_COOKIE)).toBeUndefined();
  });

  it('tidak melempar untuk header yang aneh', () => {
    expect(readCookie(';;;===;;;', GUEST_COOKIE)).toBeUndefined();
  });
});
