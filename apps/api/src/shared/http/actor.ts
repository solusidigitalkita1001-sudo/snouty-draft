/**
 * Aktor sebuah permintaan publik: pengguna ber-token ATAU tamu ber-cookie.
 *
 * Diturunkan dari dua middleware yang sudah berjalan — `AccessTokenMiddleware`
 * (mengisi `authUser`) dan `GuestSessionMiddleware` (mengisi `guestSessionId`).
 * Pengguna ber-token menang: orang yang login sambil masih membawa cookie tamu
 * lama adalah pengguna, bukan tamu.
 */
import type { Request } from 'express';
import type { Tier } from '../../modules/policy/entitlements.js';
import type { WithAuthUser } from '../../modules/auth/presentation/access-token.middleware.js';
import type { WithGuestSession } from '../../modules/auth/presentation/guest-session.middleware.js';
import { UnauthenticatedError } from './api-errors.js';

export type PublicRequest = Request & WithAuthUser & WithGuestSession;

export interface RequestActor {
  readonly kind: 'user' | 'guest';
  readonly id: string;
  /** Tamu selalu `guest`; selebihnya dari klaim token. */
  readonly tier: Tier;
  readonly roles: readonly string[];
}

export function actorOf(request: PublicRequest): RequestActor {
  if (request.authUser !== undefined) {
    return {
      kind: 'user',
      id: request.authUser.userId,
      tier: request.authUser.tier,
      roles: request.authUser.roles,
    };
  }
  if (request.guestSessionId !== undefined) {
    return { kind: 'guest', id: request.guestSessionId, tier: 'guest', roles: [] };
  }
  // Tidak terjadi pada rute publik (middleware tamu selalu mengisi), tetapi rute
  // yang salah pasang middleware harus gagal tertutup, bukan berjalan tanpa aktor.
  throw new UnauthenticatedError();
}

/** Aktor yang WAJIB pengguna ber-token — untuk endpoint seperti `/auth/me`. */
export function userOf(request: PublicRequest): RequestActor {
  const actor = actorOf(request);
  if (actor.kind !== 'user') throw new UnauthenticatedError();
  return actor;
}
