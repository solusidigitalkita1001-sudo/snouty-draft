/**
 * Resolusi aktor: pengguna ber-token menang atas cookie tamu.
 */
import { describe, expect, it } from 'vitest';
import { UnauthenticatedError } from './api-errors.js';
import { actorOf, userOf, type PublicRequest } from './actor.js';

const USER_ID = 'U'.padEnd(26, '0');
const GUEST_ID = 'G'.padEnd(26, '0');

function request(partial: Partial<PublicRequest>): PublicRequest {
  return { headers: {}, ...partial } as PublicRequest;
}

describe('actorOf', () => {
  it('memilih pengguna ber-token walau cookie tamu masih ikut terkirim', () => {
    const actor = actorOf(
      request({
        authUser: { userId: USER_ID, tier: 'registered', roles: ['admin'] },
        guestSessionId: GUEST_ID,
      }),
    );

    expect(actor).toEqual({ kind: 'user', id: USER_ID, tier: 'registered', roles: ['admin'] });
  });

  it('menjadikan tamu beraktor tier guest tanpa peran', () => {
    const actor = actorOf(request({ guestSessionId: GUEST_ID }));

    expect(actor).toEqual({ kind: 'guest', id: GUEST_ID, tier: 'guest', roles: [] });
  });

  it('gagal tertutup saat keduanya kosong — rute salah pasang middleware', () => {
    expect(() => actorOf(request({}))).toThrow(UnauthenticatedError);
  });
});

describe('userOf', () => {
  it('menolak tamu — /auth/me bukan untuk sesi tanpa akun', () => {
    expect(() => userOf(request({ guestSessionId: GUEST_ID }))).toThrow(UnauthenticatedError);
  });
});
