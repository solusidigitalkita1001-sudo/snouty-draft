/**
 * P3-09 — keadaan onboarding dari server, terhadap MySQL sungguhan.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { count } from 'drizzle-orm';
import { onboardingStates } from '../../../infrastructure/mysql/schema/identity.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import type { ConsentSubject } from '../domain/consent.repository.js';
import { OnboardingService } from '../application/onboarding.service.js';
import { MysqlOnboardingStateRepository } from './mysql-onboarding-state.repository.js';

const GUEST: ConsentSubject = { kind: 'guest', id: testId('OGUEST') };

let fixture: TestDatabase;
let service: OnboardingService;

beforeAll(async () => {
  fixture = await createTestDatabase('onboarding');
  service = new OnboardingService(new MysqlOnboardingStateRepository({ db: fixture.db }));
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
});

describe('OnboardingService', () => {
  it('menjawab pending untuk subjek yang belum pernah menyentuh onboarding — tanpa menulis baris', async () => {
    expect(await service.state(GUEST)).toBe('pending');

    const [row] = await fixture.db.select({ n: count() }).from(onboardingStates);
    expect(row?.n).toBe(0);
  });

  it('menyimpan hasil penyelesaian dan membacanya kembali', async () => {
    await service.complete(GUEST, 'done');

    expect(await service.state(GUEST)).toBe('done');
  });

  it('skip lalu done: satu baris yang diperbarui, bukan dua baris', async () => {
    // Pengguna yang melewati onboarding lalu membukanya lagi secara manual dan
    // menyelesaikannya — keadaan terkini yang berarti, bukan riwayatnya.
    await service.complete(GUEST, 'skip');
    await service.complete(GUEST, 'done');

    expect(await service.state(GUEST)).toBe('done');
    const [row] = await fixture.db.select({ n: count() }).from(onboardingStates);
    expect(row?.n).toBe(1);
  });

  it('memisahkan subjek tamu dan user yang kebetulan ber-id sama', async () => {
    await service.complete(GUEST, 'guest');

    expect(await service.state({ kind: 'user', id: GUEST.id })).toBe('pending');
  });
});
