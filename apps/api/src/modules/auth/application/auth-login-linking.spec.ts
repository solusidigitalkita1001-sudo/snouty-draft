/**
 * `login` juga menautkan percakapan tamu (invarian G-1), bukan hanya `register`.
 *
 * Lahir dari bug nyata yang dilaporkan pemilik: tamu berkonsultasi, lalu masuk ke akun yang
 * sudah ada — dan percakapannya hilang. Ia masih dimiliki sesi tamu sementara aktornya kini
 * pengguna, jadi pemeriksaan kepemilikan menolaknya. Yang terlihat di browser adalah
 * `ERR_EMPTY_RESPONSE`, karena controller SSE sudah menulis header sebelum galatnya terjadi.
 *
 * Dua hal yang diuji di sini, dan urutannya penting:
 *   - penautan terjadi **setelah** kredensial terbukti benar; menautkan lebih dulu berarti
 *     percakapan tamu berpindah hanya karena seseorang menebak sebuah email.
 *   - login tanpa cookie tamu tetap berhasil dan tidak menautkan apa pun.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { InvalidCredentialsError } from '../domain/auth.errors.js';

const USER = {
  id: '01JBLOGINUSER000000000000A',
  email: 'budi@contoh.co.id',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
  name: 'Budi',
  tier: 'registered' as const,
  status: 'active' as const,
  roles: [] as string[],
};

function build(over: { verifyResult?: boolean } = {}) {
  const link = vi.fn(() =>
    Promise.resolve({ movedConversations: 2, resumedConversationId: '01JBCONV0000000000000000AA' }),
  );

  const service = new AuthService(
    // users
    {
      findByEmail: () => Promise.resolve(USER),
      findById: () => Promise.resolve(USER),
      create: () => Promise.resolve(),
      touchLastSeen: () => Promise.resolve(),
    } as never,
    // hasher
    {
      verify: () => Promise.resolve(over.verifyResult ?? true),
      hash: () => Promise.resolve('x'),
    } as never,
    // tokens (refresh)
    {
      issue: () => Promise.resolve({ token: 'rt', expiresAt: new Date() }),
      rotate: vi.fn(),
      revokeByToken: vi.fn(),
    } as never,
    // accessTokens
    { sign: () => Promise.resolve('at'), verify: vi.fn() } as never,
    // guestLinker
    { link } as never,
  );

  return { service, link };
}

describe('login + penautan tamu (G-1)', () => {
  it('menautkan percakapan tamu dan mengembalikan id yang dilanjutkan', async () => {
    const { service, link } = build();
    const session = await service.login(
      { email: USER.email, password: 'katasandipanjang12' },
      '01JBGUEST0000000000000000A',
    );

    expect(link).toHaveBeenCalledWith('01JBGUEST0000000000000000A', USER.id);
    expect(session.resumedConversationId).toBe('01JBCONV0000000000000000AA');
  });

  it('tanpa cookie tamu: berhasil tanpa menautkan apa pun', async () => {
    const { service, link } = build();
    const session = await service.login({ email: USER.email, password: 'katasandipanjang12' });

    expect(link).not.toHaveBeenCalled();
    expect(session.resumedConversationId).toBeNull();
  });

  it('kata sandi salah: TIDAK menautkan apa pun', async () => {
    // Menautkan sebelum kredensial terbukti berarti percakapan tamu bisa dibajak dengan
    // menebak satu email.
    const { service, link } = build({ verifyResult: false });

    await expect(
      service.login({ email: USER.email, password: 'salah' }, '01JBGUEST0000000000000000A'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(link).not.toHaveBeenCalled();
  });
});
