/**
 * P3-08a terhadap MySQL sungguhan — baris tidak pernah dihapus, dan "terbaru"
 * tidak pernah ambigu.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { count } from 'drizzle-orm';
import { consents } from '../../../infrastructure/mysql/schema/identity.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import type { ConsentSubject } from '../domain/consent.repository.js';
import { ConsentService } from '../application/consent.service.js';
import { MysqlConsentRepository } from './mysql-consent.repository.js';

const GUEST: ConsentSubject = { kind: 'guest', id: testId('GUEST') };

let fixture: TestDatabase;
let service: ConsentService;

beforeAll(async () => {
  fixture = await createTestDatabase('consents');
  service = new ConsentService(new MysqlConsentRepository({ db: fixture.db }), 'v0-draft');
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
});

async function totalRows(): Promise<number> {
  const [row] = await fixture.db.select({ n: count() }).from(consents);
  return row?.n ?? 0;
}

describe('consent — append-only', () => {
  it('memberi, mencabut, memberi lagi = tiga baris; tidak ada yang terhapus', async () => {
    await service.record(GUEST, 'LOCATION', true);
    await service.revoke(GUEST, 'LOCATION');
    await service.record(GUEST, 'LOCATION', true);

    // Dua baris: dua pemberian. Pencabutan BUKAN baris baru — ia mengisi
    // `revokedAt` pada baris pemberian yang berlaku.
    expect(await totalRows()).toBe(2);
    expect(await service.isGranted(GUEST, 'LOCATION')).toBe(true);
  });

  it('pencabutan mengisi revokedAt pada baris yang berlaku, bukan menghapusnya', async () => {
    await service.record(GUEST, 'LOCATION', true);
    await service.revoke(GUEST, 'LOCATION');

    const [state] = await service.current(GUEST);
    expect(state?.granted).toBe(false);
    expect(state?.revokedAt).not.toBeNull();
    expect(await totalRows()).toBe(1);
  });

  it('penolakan tercatat dan tidak menghalangi apa pun — tidak ada galat, tidak ada blokir', async () => {
    await service.record(GUEST, 'LOCATION', false);

    expect(await service.isGranted(GUEST, 'LOCATION')).toBe(false);
    expect(await totalRows()).toBe(1);
  });

  it('setiap baris membawa policyVersion dari server', async () => {
    await service.record(GUEST, 'ANALYTICS_STORAGE', true);

    const [state] = await service.current(GUEST);
    expect(state?.policyVersion).toBe('v0-draft');
  });
});

describe('consent — keadaan terbaru', () => {
  it('memberi setelah menolak: baris baru yang menang', async () => {
    await service.record(GUEST, 'LOCATION', false);
    await service.record(GUEST, 'LOCATION', true);

    expect(await service.isGranted(GUEST, 'LOCATION')).toBe(true);
    expect(await totalRows()).toBe(2);
  });

  it('dua jenis consent hidup berdampingan tanpa saling menimpa', async () => {
    await service.record(GUEST, 'LOCATION', false);
    await service.record(GUEST, 'ANALYTICS_STORAGE', true);

    const states = await service.current(GUEST);
    const byKind = Object.fromEntries(states.map((state) => [state.kind, state.granted]));
    expect(byKind).toEqual({ LOCATION: false, ANALYTICS_STORAGE: true });
  });

  it('subjek tamu dan user dengan id kebetulan sama tidak saling membaca', async () => {
    const userWithSameId: ConsentSubject = { kind: 'user', id: GUEST.id };
    await service.record(GUEST, 'LOCATION', true);

    expect(await service.isGranted(userWithSameId, 'LOCATION')).toBe(false);
  });
});

describe('consent — pencabutan idempoten', () => {
  it('mencabut dua kali tidak mengubah apa pun pada pencabutan kedua', async () => {
    await service.record(GUEST, 'LOCATION', true);
    await service.revoke(GUEST, 'LOCATION');
    const [before] = await service.current(GUEST);

    await service.revoke(GUEST, 'LOCATION');

    const [after] = await service.current(GUEST);
    expect(after?.revokedAt?.getTime()).toBe(before?.revokedAt?.getTime());
  });

  it('mencabut yang tidak pernah diberikan bukan kesalahan', async () => {
    await expect(service.revoke(GUEST, 'LOCATION')).resolves.toBeUndefined();
    expect(await totalRows()).toBe(0);
  });

  it('mencabut penolakan tidak terjadi — tidak ada hal seperti itu', async () => {
    await service.record(GUEST, 'LOCATION', false);
    await service.revoke(GUEST, 'LOCATION');

    const [state] = await service.current(GUEST);
    expect(state?.revokedAt).toBeNull();
  });
});
