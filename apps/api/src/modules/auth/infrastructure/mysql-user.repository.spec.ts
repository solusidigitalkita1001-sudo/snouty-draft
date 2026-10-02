/**
 * Jalur yang hanya MySQL bisa buktikan: email ganda ditangkap dari unique index —
 * termasuk saat dua registrasi BERPACU, celah yang find-lalu-insert tidak bisa tutup.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { userRoles } from '../../../infrastructure/mysql/schema/identity.js';
import { EmailAlreadyRegisteredError } from '../domain/auth.errors.js';
import { MysqlUserRepository } from './mysql-user.repository.js';

let fixture: TestDatabase;
let repository: MysqlUserRepository;

beforeAll(async () => {
  fixture = await createTestDatabase('users');
  repository = new MysqlUserRepository({ db: fixture.db });
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
});

function user(id: string, email: string) {
  return { id, email, passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA', name: 'Tes' };
}

describe('MysqlUserRepository', () => {
  it('melempar EmailAlreadyRegisteredError dari unique index, bukan galat driver mentah', async () => {
    await repository.create(user(testId('U1'), 'sama@example.test'));

    await expect(repository.create(user(testId('U2'), 'sama@example.test'))).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
  });

  it('memenangkan balapan: dua create serentak menghasilkan tepat satu pengguna', async () => {
    const outcomes = await Promise.allSettled([
      repository.create(user(testId('UA'), 'balapan@example.test')),
      repository.create(user(testId('UB'), 'balapan@example.test')),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('mengembalikan seluruh peran tanpa menggandakan field pengguna', async () => {
    const id = testId('U3');
    await repository.create(user(id, 'peran@example.test'));
    await fixture.db.insert(userRoles).values([
      { userId: id, role: 'catalog_admin' },
      { userId: id, role: 'admin' },
    ]);

    const found = await repository.findById(id);

    expect(found?.roles.length).toBe(2);
    expect([...(found?.roles ?? [])].sort()).toEqual(['admin', 'catalog_admin']);
    expect(found?.email).toBe('peran@example.test');
  });

  it('mengembalikan daftar peran kosong untuk pengguna tanpa peran — left join, bukan inner', async () => {
    const id = testId('U4');
    await repository.create(user(id, 'polos@example.test'));

    const found = await repository.findById(id);

    expect(found?.roles).toEqual([]);
  });
});
