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
