/**
 * Batas laju per tier. docs/POLICY.md §10 · docs/SECURITY.md §8.
 * **Fungsi murni** — modul `policy` wajib leaf, jadi penghitungnya hidup di tempat lain.
 *
 * Batasnya bagian dari kebijakan, bukan infrastruktur: ia berbeda per tier, dan itu
 * keputusan produk. Angkanya dikonfigurasi lewat env, bukan literal di kode — tetapi
 * **bakunya** ada di sini supaya sistem tetap terlindungi saat env belum diisi. Batas yang
 * hanya berlaku bila seseorang ingat mengisi variabel bukan batas.
 */

import type { Tier } from './entitlements.js';

export type RateDimension =
  | 'messages_per_hour'
  | 'advanced_cases_per_day'
  | 'schematics_per_day'
  | 'reports_per_day'
  | 'uploads_per_day';

export interface RateLimit {
  readonly max: number;
  readonly windowSeconds: number;
}

const HOUR = 3_600;
const DAY = 86_400;

/**
 * `null` berarti kapabilitasnya memang tidak dimiliki tier itu — dan itu ditolak oleh
 * gerbang entitlement sebelum rate limiter sempat melihatnya. Mencantumkannya di sini
 * membuat tabelnya terbaca sejajar dengan tabel di POLICY.md §10.
 */
export const RATE_LIMITS: Readonly<
  Record<Tier, Readonly<Record<RateDimension, RateLimit | null>>>
> = {
  guest: {
    messages_per_hour: { max: 20, windowSeconds: HOUR },
    advanced_cases_per_day: null,
    schematics_per_day: null,
    reports_per_day: null,
    uploads_per_day: { max: 2, windowSeconds: DAY },
  },
  registered: {
    messages_per_hour: { max: 60, windowSeconds: HOUR },
    advanced_cases_per_day: { max: 5, windowSeconds: DAY },
    schematics_per_day: { max: 10, windowSeconds: DAY },
    reports_per_day: { max: 5, windowSeconds: DAY },
    uploads_per_day: { max: 10, windowSeconds: DAY },
  },
  advanced: {
    messages_per_hour: { max: 180, windowSeconds: HOUR },
    advanced_cases_per_day: { max: 20, windowSeconds: DAY },
    schematics_per_day: { max: 40, windowSeconds: DAY },
    reports_per_day: { max: 20, windowSeconds: DAY },
    uploads_per_day: { max: 30, windowSeconds: DAY },
  },
};

/**
 * Batas endpoint autentikasi, **per IP** dan bukan per tier: yang dihambat adalah
 * credential stuffing, dan penyerang tidak punya tier (docs/SECURITY.md §8).
 */
export const AUTH_IP_LIMIT: RateLimit = { max: 10, windowSeconds: 15 * 60 };

export function limitFor(tier: Tier, dimension: RateDimension): RateLimit | null {
  return RATE_LIMITS[tier][dimension];
}

/** Sisa kuota setelah `used` permintaan. Dipakai header `X-RateLimit-Remaining`. */
export function remaining(limit: RateLimit, used: number): number {
  return Math.max(0, limit.max - used);
}
