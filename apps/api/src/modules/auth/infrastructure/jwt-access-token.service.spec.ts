/**
 * Access token: yang ditandatangani harus kembali, dan yang dipalsukan tidak boleh.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { JwtAccessTokenService } from './jwt-access-token.service.js';

const SECRET = 'rahasia-tes-sepanjang-tiga-puluh-dua-karakter';
const USER = 'U'.padEnd(26, '0');

beforeAll(() => {
  process.env['JWT_ACCESS_SECRET'] = SECRET;
  process.env['JWT_REFRESH_SECRET'] = SECRET + '-refresh';
  process.env['JWT_ACCESS_TTL'] = '900';
  process.env['DB_HOST'] = '127.0.0.1';
  process.env['DB_DATABASE'] = 'snouty_test';
  process.env['DB_USERNAME'] = 'root';
  process.env['DB_PASSWORD'] = 'test';
});

function service(): JwtAccessTokenService {
  return new JwtAccessTokenService();
}

describe('JwtAccessTokenService', () => {
  it('mengembalikan klaim yang ditandatanganinya sendiri', async () => {
    const svc = service();
    const token = await svc.sign({ userId: USER, tier: 'registered', roles: ['catalog_admin'] });

    const claims = await svc.verify(token);

    expect(claims).toEqual({ userId: USER, tier: 'registered', roles: ['catalog_admin'] });
  });

  it('tidak membawa email maupun nama — JWT hanya base64, bukan terenkripsi', async () => {
    const token = await service().sign({ userId: USER, tier: 'registered', roles: [] });
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());

    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss', 'roles', 'sub', 'tier']);
  });

  it('menolak token yang ditandatangani rahasia lain', async () => {
    const forged = await new SignJWT({ tier: 'advanced', roles: ['admin'] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER)
      .setIssuer('snouty-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('rahasia-lain-yang-juga-32-karakter-xx'));

    expect(await service().verify(forged)).toBeNull();
  });

  it('menolak token tanpa tanda tangan (alg none)', async () => {
    // Kebingungan algoritme adalah kegagalan JWT paling klasik; `algorithms`
    // dikunci HS256 justru untuk ini.
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: USER, iss: 'snouty-api', tier: 'advanced', roles: ['admin'] }),
    ).toString('base64url');

    expect(await service().verify(`${header}.${payload}.`)).toBeNull();
  });

  it('menolak token yang sudah kedaluwarsa', async () => {
    const expired = await new SignJWT({ tier: 'registered', roles: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER)
      .setIssuer('snouty-api')
      .setIssuedAt(Math.floor(Date.now() / 1_000) - 7_200)
      .setExpirationTime(Math.floor(Date.now() / 1_000) - 3_600)
      .sign(new TextEncoder().encode(SECRET));

    expect(await service().verify(expired)).toBeNull();
  });

  it('menolak issuer lain — token aplikasi tetangga bukan token kita', async () => {
    const foreign = await new SignJWT({ tier: 'registered', roles: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER)
      .setIssuer('aplikasi-lain')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));

    expect(await service().verify(foreign)).toBeNull();
  });

  it('menolak sampah tanpa melempar', async () => {
    expect(await service().verify('bukan.jwt.sama-sekali')).toBeNull();
    expect(await service().verify('')).toBeNull();
  });

  it('menolak tier di luar kosakata, bukan meloloskannya sebagai string bebas', async () => {
    const odd = await new SignJWT({ tier: 'enterprise', roles: [] })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER)
      .setIssuer('snouty-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));

    expect(await service().verify(odd)).toBeNull();
  });
});
