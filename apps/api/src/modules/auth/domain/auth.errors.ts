/**
 * Galat autentikasi — satu pesan untuk semua penyebab, dan itu intinya.
 *
 * Token tidak dikenal, kedaluwarsa, dicabut, atau terdeteksi dipakai ulang:
 * semuanya keluar sebagai `UNAUTHENTICATED` dengan kalimat yang sama. Membedakan
 * pesannya memberi penyerang osilograf gratis — "dicabut" memberi tahu bahwa
 * tokennya pernah sah, "dipakai ulang" memberi tahu deteksinya ada. Yang berhak
 * tahu detailnya adalah log server, bukan responsnya.
 */

export class InvalidRefreshTokenError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor(
    /** Untuk log server saja; `ApiErrorFilter` tidak pernah meneruskannya. */
    readonly reason: 'unknown' | 'expired' | 'revoked' | 'reused' | 'user_disabled',
  ) {
    super('Silakan masuk terlebih dahulu.');
    this.name = 'InvalidRefreshTokenError';
  }
}

/**
 * Email atau password salah — SATU galat untuk keduanya.
 *
 * "Email tidak terdaftar" dan "password salah" yang dibedakan memberi siapa pun
 * mesin pengecek keanggotaan: cukup coba login untuk tahu alamat mana yang punya
 * akun. Satu pesan menutup kanal itu.
 */
export class InvalidCredentialsError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor() {
    super('Email atau password tidak cocok.');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Akun dinonaktifkan. Pesannya sama dengan kredensial salah, dan itu disengaja:
 * memberi tahu bahwa akunnya ada tetapi dinonaktifkan adalah informasi — dan untuk
 * akun internal yang baru dicabut aksesnya, informasi yang sensitif.
 */
export class AccountDisabledError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor() {
    super('Email atau password tidak cocok.');
    this.name = 'AccountDisabledError';
  }
}

/**
 * Access token yang DIKIRIM sudah tidak sah (biasanya kedaluwarsa — umurnya 15 menit). Dulu ia
 * diturunkan diam-diam menjadi tamu, sehingga percakapan milik akun menjawab 404 dan web tidak
 * pernah tahu harus memperbarui sesi (laporan pemilik 2026-10-09). Sekarang 401: web memulihkan
 * sesi dari cookie refresh lalu mengulang permintaannya.
 */
export class ExpiredAccessTokenError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;

  constructor() {
    super('Sesi Anda sudah berakhir. Silakan muat ulang halaman.');
    this.name = 'ExpiredAccessTokenError';
  }
}

/**
 * Email sudah terdaftar.
 *
 * Registrasi memang membocorkan keberadaan akun — tidak ada cara menolak email
 * ganda tanpa mengatakannya. Yang bisa dijaga adalah TEMPATNYA: hanya di sini,
 * dengan pesan yang membantu pemilik asli ("silakan masuk"), bukan di login.
 */
export class EmailAlreadyRegisteredError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { fields: ['email'] } as const;

  constructor() {
    super('Email ini sudah terdaftar. Silakan masuk.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Ganti sandi (OQ-53): sandi saat ini tidak cocok. 400, bukan 401 — sesinya sah, isiannya yang
 * salah; 401 akan membuat klien mengira sesinya habis dan mengeluarkannya.
 */
export class CurrentPasswordMismatchError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details = { fields: ['currentPassword'], reason: 'current_password' } as const;

  constructor() {
    super('Kata sandi saat ini tidak cocok.');
    this.name = 'CurrentPasswordMismatchError';
  }
}

/** Password ditolak kebijakan. `details.reason` dipakai UI untuk pesan yang tepat. */
export class PasswordRejectedError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(reason: string) {
    super('Password belum memenuhi syarat minimal 12 karakter.');
    this.name = 'PasswordRejectedError';
    this.details = { fields: ['password'], reason };
  }
}
