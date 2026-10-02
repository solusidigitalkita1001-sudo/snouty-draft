/**
 * Galat API lintas-modul. Masing-masing membawa kode stabil dari
 * docs/API_CONTRACTS.md §4; `ApiErrorFilter` yang mengubahnya menjadi respons.
 *
 * Pesannya Bahasa Indonesia dan aman ditampilkan apa adanya — itu kontraknya,
 * bukan kelonggaran.
 */

export class UnauthenticatedError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor() {
    super('Silakan masuk terlebih dahulu.');
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Peran yang diminta tidak dipegang aktor.
 *
 * `details.role` ikut dikirim karena layar back-office memakainya untuk
 * menjelaskan apa yang kurang, bukan hanya mengatakan "tidak boleh". Nama peran
 * bukan rahasia; yang rahasia adalah siapa yang memegangnya.
 */
export class NotEntitledError extends Error {
  readonly code = 'NOT_ENTITLED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(role: string) {
    super('Anda tidak punya akses ke area ini.');
    this.name = 'NotEntitledError';
    this.details = { role };
  }
}

/**
 * Rute internal terpasang tanpa menyebut peran yang dibutuhkan.
 *
 * Ini galat pemrogram, bukan galat pengguna, dan sengaja **menutup** rutenya
 * alih-alih membukanya. Rute internal yang lupa diberi peran adalah rute internal
 * tanpa penjagaan; gagal tertutup membuat kelalaian itu terlihat pada permintaan
 * pertama, bukan pada insiden pertama.
 */
export class InternalRouteMisconfiguredError extends Error {
  readonly code = 'SERVICE_UNAVAILABLE' as const;

  constructor(route: string) {
    super('Layanan sedang tidak tersedia.');
    this.name = 'InternalRouteMisconfiguredError';
    // Detailnya hanya untuk log server; `ApiErrorFilter` tidak meneruskannya.
    this.cause = `rute internal tanpa peran yang diminta: ${route}`;
  }
}

/**
 * Kapabilitas tidak tersedia untuk tier aktor — pesan dan `details.capability`
 * mengikuti contoh kontrak (docs/API_CONTRACTS.md §1).
 */
export class NotEntitledCapabilityError extends Error {
  readonly code = 'NOT_ENTITLED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(capability: string) {
    super('Fitur ini tersedia untuk pengguna terdaftar.');
    this.name = 'NotEntitledCapabilityError';
    this.details = { capability };
  }
}

/** Body atau parameter tidak lolos skema. `details.fields` menyebut yang bermasalah. */
export class RequestValidationError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(fields: readonly string[]) {
    super('Ada isian yang belum sesuai.');
    this.name = 'RequestValidationError';
    this.details = { fields };
  }
}

/**
 * Batas laju terlampaui. docs/POLICY.md §10 · docs/SECURITY.md §8.
 *
 * Membawa `retryAfterSec` karena menolak tanpa memberi tahu kapan boleh mencoba lagi
 * memaksa klien menebak — dan klien yang menebak akan mencoba terlalu cepat.
 */
export class RateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';
  readonly details: Readonly<Record<string, unknown>>;

  constructor(readonly retryAfterSec: number) {
    super('Permintaan terlalu sering. Coba lagi sebentar.');
    this.name = 'RateLimitedError';
    this.details = { retryAfterSec };
  }
}
