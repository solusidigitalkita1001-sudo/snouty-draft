/**
 * P3-05a — use case autentikasi.
 *
 * Hasher di sini hasher **sungguhan** (Argon2), bukan mock: tes anti-enumerasi
 * mengukur bahwa jalur "email tidak ada" membayar biaya verifikasi yang sama
 * dengan jalur "password salah", dan biaya adalah hal yang tidak bisa di-mock.
 */
import { describe, expect, it } from 'vitest';
import {
  AccountDisabledError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  PasswordRejectedError,
} from '../domain/auth.errors.js';
import type { GuestAccountLinker, LinkResult } from '../domain/guest-account-linker.port.js';
import type { NewUser, UserRepository, UserRow } from '../domain/user.repository.js';
import type {
  NewRefreshToken,
  RefreshTokenRepository,
  RefreshTokenRow,
} from '../domain/refresh-token.repository.js';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher.js';
import type {
  AccessTokenClaims,
  AccessTokenService,
} from '../infrastructure/jwt-access-token.service.js';
import { TokenService } from './token.service.js';
import { AuthService, normalizeEmail } from './auth.service.js';

const PASSWORD = 'sandi-pengembangan-yang-panjang';

class MemoryUsers implements UserRepository {
  readonly rows = new Map<string, UserRow>();
  lastSeenTouched: string[] = [];

  async findByEmail(email: string): Promise<UserRow | null> {
    for (const row of this.rows.values()) if (row.email === email) return row;
    return null;
  }

  async findById(id: string): Promise<UserRow | null> {
    return this.rows.get(id) ?? null;
  }

  async create(user: NewUser): Promise<void> {
    if (await this.findByEmail(user.email)) throw new EmailAlreadyRegisteredError();
    this.rows.set(user.id, { ...user, tier: 'registered', status: 'active', roles: [] });
  }

  async touchLastSeen(id: string): Promise<void> {
    this.lastSeenTouched.push(id);
  }
}

class MemoryTokens implements RefreshTokenRepository {
  readonly rows = new Map<
    string,
    RefreshTokenRow & { usedAt: Date | null; revokedAt: Date | null }
  >();

  async create(token: NewRefreshToken): Promise<void> {
    this.rows.set(token.id, { ...token, usedAt: null, revokedAt: null });
  }

  async findByTokenHash(hash: string): Promise<RefreshTokenRow | null> {
    for (const row of this.rows.values()) if (row.tokenHash === hash) return row;
    return null;
  }

  async markUsed(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.usedAt = new Date();
  }

  async revokeFamily(familyId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.familyId === familyId && row.revokedAt === null) row.revokedAt = new Date();
    }
  }
}

/** Penandatangan palsu yang jejak klaimnya bisa dibaca — JWT asli diuji terpisah. */
class FakeAccessTokens implements AccessTokenService {
  signed: AccessTokenClaims[] = [];

  async sign(claims: AccessTokenClaims): Promise<string> {
    this.signed.push(claims);
    return `token-untuk-${claims.userId}`;
  }

  async verify(): Promise<AccessTokenClaims | null> {
    return null;
  }
}

class RecordingLinker implements GuestAccountLinker {
  readonly linked: Array<{ guestSessionId: string; userId: string }> = [];
  result: LinkResult = { movedConversations: 0, resumedConversationId: null };

  async link(guestSessionId: string, userId: string): Promise<LinkResult> {
    this.linked.push({ guestSessionId, userId });
    return this.result;
  }
}

function setup() {
  const users = new MemoryUsers();
  const refreshRepo = new MemoryTokens();
  const accessTokens = new FakeAccessTokens();
  const linker = new RecordingLinker();
  const service = new AuthService(
    users,
    new Argon2PasswordHasher(),
    new TokenService(refreshRepo, 3_600),
    accessTokens,
    linker,
  );
  return { users, refreshRepo, accessTokens, linker, service };
}

const REGISTER = { email: 'Pengguna@Example.test', password: PASSWORD, name: '  Pengguna  ' };

describe('register', () => {
  it('menyimpan email huruf kecil dan nama yang dirapikan — passwordnya hanya sebagai hash', async () => {
    const { users, service } = setup();

    const session = await service.register(REGISTER);

    const stored = users.rows.get(session.userId)!;
    expect(stored.email).toBe('pengguna@example.test');
    expect(stored.name).toBe('Pengguna');
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.stringify([...users.rows.values()])).not.toContain(PASSWORD);
  });

  it('langsung membuka sesi — pengguna baru tidak disuruh login dua kali', async () => {
    const { service } = setup();

    const session = await service.register(REGISTER);

    expect(session.accessToken).toBeTruthy();
    expect(session.refresh.token).toBeTruthy();
  });

  it('menolak password di bawah kebijakan SEBELUM menyentuh repository', async () => {
    const { users, service } = setup();

    await expect(service.register({ ...REGISTER, password: 'pendek' })).rejects.toThrow(
      PasswordRejectedError,
    );
    expect(users.rows.size).toBe(0);
  });

  it('menolak email yang sudah terdaftar, tanpa membedakan huruf besar-kecil', async () => {
    const { service } = setup();
    await service.register(REGISTER);

    await expect(service.register({ ...REGISTER, email: 'PENGGUNA@example.TEST' })).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
  });
});

describe('register — penautan tamu (G-1 lewat port)', () => {
  it('menautkan sesi tamu yang dibawa dan meneruskan resumedConversationId', async () => {
    const { linker, service } = setup();
    linker.result = { movedConversations: 2, resumedConversationId: 'CONV' };

    const session = await service.register({ ...REGISTER, guestSessionId: 'GSESSION' });

    expect(linker.linked).toEqual([{ guestSessionId: 'GSESSION', userId: session.userId }]);
    expect(session.resumedConversationId).toBe('CONV');
  });

  it('tanpa cookie tamu: tidak ada penautan, resumedConversationId null', async () => {
    const { linker, service } = setup();

    const session = await service.register(REGISTER);

    expect(linker.linked).toEqual([]);
    expect(session.resumedConversationId).toBeNull();
  });
});

describe('login', () => {
  it('membuka sesi untuk kredensial yang benar dan menyentuh lastSeen', async () => {
    const { users, service } = setup();
    const registered = await service.register(REGISTER);

    const session = await service.login({ email: 'pengguna@example.test', password: PASSWORD });

    expect(session.userId).toBe(registered.userId);
    expect(users.lastSeenTouched).toEqual([registered.userId]);
  });

  it('menjawab email tak dikenal dan password salah dengan galat yang sama', async () => {
    const { service } = setup();
    await service.register(REGISTER);

    const wrongPassword = await service
      .login({ email: 'pengguna@example.test', password: 'password-yang-salah' })
      .catch((error: Error) => error);
    const unknownEmail = await service
      .login({ email: 'tidak-ada@example.test', password: PASSWORD })
      .catch((error: Error) => error);

    expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError);
    expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message);
  });

  it('membayar biaya Argon2 juga saat emailnya tidak terdaftar — anti enumerasi lewat waktu', async () => {
    const { service } = setup();
    await service.register(REGISTER);

    // Pemanasan supaya JIT dan alokasi pertama tidak mencemari pengukuran.
    await service.login({ email: 'tidak-ada@example.test', password: PASSWORD }).catch(() => {});

    const t0 = performance.now();
    await service.login({ email: 'tidak-ada@example.test', password: PASSWORD }).catch(() => {});
    const unknownMs = performance.now() - t0;

    // Verifikasi Argon2id dengan parameter ini ~10 ms; jalur yang melewatkannya
    // selesai < 1 ms. Ambang 5 ms memisahkan keduanya dengan margin lebar tanpa
    // menjadi rapuh terhadap mesin yang lambat.
    expect(unknownMs).toBeGreaterThan(5);
  });

  it('menolak akun nonaktif dengan pesan yang sama seperti kredensial salah', async () => {
    const { users, service } = setup();
    const registered = await service.register(REGISTER);
    users.rows.set(registered.userId, {
      ...users.rows.get(registered.userId)!,
      status: 'disabled',
    });

    const error = await service
      .login({ email: 'pengguna@example.test', password: PASSWORD })
      .catch((caught: Error) => caught);

    expect(error).toBeInstanceOf(AccountDisabledError);
    expect((error as Error).message).toBe(new InvalidCredentialsError().message);
  });
});

describe('refresh', () => {
  it('menukar refresh token dengan sesi baru berisi klaim terkini', async () => {
    const { users, accessTokens, service } = setup();
    const registered = await service.register(REGISTER);
    // Peran berubah SETELAH login — klaim di access token berikutnya harus ikut.
    users.rows.set(registered.userId, {
      ...users.rows.get(registered.userId)!,
      roles: ['catalog_admin'],
    });

    const refreshed = await service.refresh(registered.refresh.token);

    expect(refreshed.roles).toEqual(['catalog_admin']);
    expect(accessTokens.signed.at(-1)?.roles).toEqual(['catalog_admin']);
  });

  it('menghentikan sesi pengguna yang dinonaktifkan SETELAH login', async () => {
    const { users, refreshRepo, service } = setup();
    const registered = await service.register(REGISTER);
    users.rows.set(registered.userId, {
      ...users.rows.get(registered.userId)!,
      status: 'disabled',
    });

    await expect(service.refresh(registered.refresh.token)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    // Rantainya ikut dicabut — bukan sekadar ditolak sekali.
    const family = [...refreshRepo.rows.values()];
    expect(family.every((row) => row.revokedAt !== null)).toBe(true);
  });
});

describe('logout', () => {
  it('mencabut rantai sehingga refresh berikutnya gagal', async () => {
    const { service } = setup();
    const registered = await service.register(REGISTER);

    await service.logout(registered.refresh.token);

    await expect(service.refresh(registered.refresh.token)).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });
});

describe('normalizeEmail', () => {
  it('huruf kecil + trim, dan tidak lebih dari itu', () => {
    expect(normalizeEmail('  Nama.Saya@Example.TEST ')).toBe('nama.saya@example.test');
    // Titik TIDAK dibuang: normalisasi ala Gmail mengubah alamat milik orang
    // menjadi alamat milik orang lain di penyedia yang aturannya berbeda.
    expect(normalizeEmail('nama.saya@example.test')).toContain('.');
  });
});
