/**
 * Cookie sesi tamu — dibuat otomatis pada permintaan pertama
 * (docs/API_CONTRACTS.md §1).
 *
 * Dipasang HANYA pada rute `/api/v1` publik, bukan pada `/health` maupun
 * `/internal/*`. Alasannya bukan kerapian: setiap sesi adalah satu baris database,
 * dan health check yang dipanggil pemeriksa infrastruktur tiap sepuluh detik akan
 * menulis 8.640 baris sehari tanpa pernah menjadi tamu siapa pun. Rute internal
 * memakai autentikasi akun, bukan sesi tamu.
 *
 * Cookie-nya `httpOnly` + `SameSite=Lax` + `Secure` di produksi. Dibaca manual dari
 * header, tanpa cookie-parser: satu nama cookie tidak butuh dependensi.
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { GuestSessionService } from '../application/guest-session.service.js';

export const GUEST_COOKIE = 'snouty_guest';

export interface WithGuestSession {
  guestSessionId?: string;
}

@Injectable()
export class GuestSessionMiddleware implements NestMiddleware {
  /**
   * Dibaca langsung, bukan lewat `loadEnv()`: middleware ini hanya butuh satu
   * boolean, dan `loadEnv` memvalidasi SELURUH konfigurasi — termasuk rahasia JWT
   * yang tidak ada urusannya dengan cookie tamu. Validasi penuh tetap terjadi satu
   * kali saat boot di `main.ts`; mengulanginya di sini hanya membuat unit test
   * middleware menuntut environment database.
   */
  private readonly secure = process.env['NODE_ENV'] === 'production';

  constructor(private readonly sessions: GuestSessionService) {}

  async use(
    request: Request & WithGuestSession,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const ensured = await this.sessions.ensure(readCookie(request.headers.cookie, GUEST_COOKIE));

    request.guestSessionId = ensured.id;
    if (ensured.setCookie) {
      response.cookie(GUEST_COOKIE, ensured.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.secure,
        expires: ensured.expiresAt,
        path: '/',
      });
    }
    next();
  }
}

/** Satu nama, satu nilai; selebihnya urusan klien. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}
