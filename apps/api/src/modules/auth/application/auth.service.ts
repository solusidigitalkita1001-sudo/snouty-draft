/**
 * Use case autentikasi: register, login, refresh, logout. docs/SECURITY.md §3.
 *
 * Dua keputusan yang tidak terlihat dari tanda tangannya:
 *
 * **Login selalu membayar satu verifikasi Argon2, juga saat emailnya tidak
 * terdaftar.** Tanpa itu, jalur "email tidak ada" selesai dalam mikrodetik dan
 * jalur "password salah" dalam puluhan milidetik — dan selisih itu adalah mesin
 * pengecek keanggotaan yang bekerja walau pesannya sudah disamakan. Hash boneka
 * yang diverifikasi adalah hash Argon2id sungguhan, supaya biayanya setara.
 *
 * **Penautan sesi tamu terjadi lewat port `GuestAccountLinker`**, bukan lewat
 * pengetahuan langsung tentang tabel percakapan: use case ini hanya tahu "tautkan
 * sesi ini ke akun itu", dan satu-satunya implementasinya memegang transaksi
 * lintas-konteks G-1.
 */

import { ulid } from '../../../shared/ulid.js';
import {
  AccountDisabledError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  PasswordRejectedError,
} from '../domain/auth.errors.js';
import { checkPassword } from '../domain/password-policy.js';
import type { GuestAccountLinker } from '../domain/guest-account-linker.port.js';
import type { PasswordHasher } from '../domain/password-hasher.port.js';
import type { UserRepository, UserRow } from '../domain/user.repository.js';
import type { AccessTokenService } from '../infrastructure/jwt-access-token.service.js';
import { TokenService, type IssuedRefreshToken } from './token.service.js';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface RegisterInput extends Credentials {
  readonly name: string;
  /** Sesi tamu yang sedang berjalan — percakapannya ikut pindah (G-1). */
  readonly guestSessionId?: string;
}

export interface AuthenticatedSession {
  readonly userId: string;
  readonly name: string;
  readonly tier: 'registered' | 'advanced';
  readonly roles: readonly string[];
  readonly accessToken: string;
  readonly refresh: IssuedRefreshToken;
}

export interface RegisteredSession extends AuthenticatedSession {
  /**
   * Percakapan tamu yang terakhir disentuh, bila ada yang ikut pindah — UI
   * melanjutkan kasus yang SAMA alih-alih membuang konteks (SPEC §4.4).
   */
  readonly resumedConversationId: string | null;
}

/**
 * Hash Argon2id SAH dari 32 byte acak yang sudah dibuang — dibangkitkan sekali
 * dengan pustaka yang sama, bukan dikarang. Ini penting: hash karangan gagal
 * diurai dan `verify` kembali dalam mikrodetik lewat jalur galatnya, yang justru
 * mengalahkan pertahanan timing yang hash ini layani. Verifikasi terhadapnya
 * terukur ~11 ms — setara jalur password salah yang sesungguhnya.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$g5U6XVrSEAYx3vg3v9mIfw$7h8Wbt0vWYPHeT2fF8hsexVp2D6vwWmPVUjkj3uKo3Q';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly guestLinker: GuestAccountLinker,
  ) {}

  async register(input: RegisterInput): Promise<RegisteredSession> {
    const rejection = checkPassword(input.password);
    if (rejection !== null) throw new PasswordRejectedError(rejection);

    const user = {
      id: ulid(),
      email: normalizeEmail(input.email),
      passwordHash: await this.hasher.hash(input.password),
      name: input.name.trim(),
    };
    // Email ganda dilempar repository dari unique index-nya — bukan dari
    // pemeriksaan find-lalu-insert yang punya celah balapan di antaranya.
    await this.users.create(user);

    // Penautan G-1 setelah akun ada. Ia idempoten dan tidak pernah melempar untuk
    // sesi yang tidak bisa ditautkan — registrasi tidak boleh gagal karena cookie
    // tamunya basi.
    const linked =
      input.guestSessionId !== undefined
        ? await this.guestLinker.link(input.guestSessionId, user.id)
        : { movedConversations: 0, resumedConversationId: null };

    const session = await this.openSession({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      tier: 'registered',
      status: 'active',
      roles: [],
    });
    return { ...session, resumedConversationId: linked.resumedConversationId };
  }

  async login(credentials: Credentials): Promise<AuthenticatedSession> {
    const user = await this.users.findByEmail(normalizeEmail(credentials.email));

    if (user === null) {
      // Bayar biaya verifikasi yang sama dengan jalur password salah, supaya
      // waktu respons tidak membocorkan email mana yang terdaftar.
      await this.hasher.verify(DUMMY_HASH, credentials.password);
      throw new InvalidCredentialsError();
    }

    const matches = await this.hasher.verify(user.passwordHash, credentials.password);
    if (!matches) throw new InvalidCredentialsError();

    // Diperiksa SETELAH password: akun nonaktif dengan password salah harus
    // menjawab persis seperti akun aktif dengan password salah.
    if (user.status === 'disabled') throw new AccountDisabledError();

    await this.users.touchLastSeen(user.id);
    return this.openSession(user);
  }

  /** Menukar refresh token: access token baru + refresh token baru (rotasi). */
  async refresh(rawRefreshToken: string): Promise<AuthenticatedSession> {
    const rotated = await this.tokens.rotate(rawRefreshToken);

    const user = await this.users.findById(rotated.userId);
    // Pengguna yang hilang atau dinonaktifkan SETELAH login: sesinya berhenti di
    // refresh berikutnya — persis jendela waktu yang dibeli access token pendek.
    // Galatnya galat refresh ("silakan masuk"), bukan galat kredensial: pemanggil
    // endpoint ini membawa cookie, bukan email dan password.
    if (user === null || user.status === 'disabled') {
      await this.tokens.revokeByToken(rotated.token);
      throw new InvalidRefreshTokenError('user_disabled');
    }

    return {
      userId: user.id,
      name: user.name,
      tier: user.tier,
      roles: user.roles,
      accessToken: await this.sign(user),
      refresh: rotated,
    };
  }

  /** Mencabut di server. Token tak dikenal tetap sukses — sesinya memang sudah mati. */
  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokens.revokeByToken(rawRefreshToken);
  }

  private async openSession(user: UserRow): Promise<AuthenticatedSession> {
    return {
      userId: user.id,
      name: user.name,
      tier: user.tier,
      roles: user.roles,
      accessToken: await this.sign(user),
      refresh: await this.tokens.issue(user.id),
    };
  }

  private async sign(user: UserRow): Promise<string> {
    return this.accessTokens.sign({ userId: user.id, tier: user.tier, roles: user.roles });
  }
}

/**
 * Huruf kecil + trim, dan tidak lebih dari itu. Normalisasi yang lebih agresif
 * (membuang titik ala Gmail) mengubah alamat milik orang menjadi alamat milik
 * orang lain di penyedia yang aturannya berbeda.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
