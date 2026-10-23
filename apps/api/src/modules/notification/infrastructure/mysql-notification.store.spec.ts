/**
 * Pemberitahuan di MySQL (P27-07, migration 0031). Yang dipaku: urutannya terbaru dulu, hitungan
 * belum dibaca benar, dan menandai terbaca TIDAK PERNAH menyentuh baris orang lain — id datang
 * dari klien.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { users, userRoles } from '../../../infrastructure/mysql/schema/identity.js';
import { MysqlNotificationStore } from './mysql-notification.store.js';
import { NotificationService } from '../application/notification.service.js';

const SALES = testId('NSALES');
const ADMIN = testId('NADMIN');
const OTHER = testId('NOTHER');

let fixture: TestDatabase;
let store: MysqlNotificationStore;
let service: NotificationService;

beforeAll(async () => {
  fixture = await createTestDatabase('notifications');
  store = new MysqlNotificationStore({ db: fixture.db });
  service = new NotificationService(store);
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  await fixture.db.insert(users).values([
    { id: SALES, email: 'sales@example.test', passwordHash: 'x'.repeat(60), name: 'Sales' },
    { id: ADMIN, email: 'admin@example.test', passwordHash: 'x'.repeat(60), name: 'Admin' },
    { id: OTHER, email: 'lain@example.test', passwordHash: 'x'.repeat(60), name: 'Lain' },
  ]);
});

describe('pemberitahuan', () => {
  it('yang baru di atas, dengan kejadian dan datanya — bukan kalimat', async () => {
    await service.notify({ userId: SALES, kind: 'lead_assigned', subjectId: OTHER });
    await service.notify({
      userId: SALES,
      kind: 'contact_requested',
      subjectId: OTHER,
      data: { source: 'price' },
    });
    const items = await service.list(SALES);
    expect(items.map((row) => row.kind)).toEqual(['contact_requested', 'lead_assigned']);
    expect(items[0]).toMatchObject({ subjectId: OTHER, data: { source: 'price' }, readAt: null });
  });

  it('hitungan belum dibaca hanya menghitung miliknya', async () => {
    await service.notify({ userId: SALES, kind: 'lead_assigned' });
    await service.notify({ userId: OTHER, kind: 'lead_assigned' });
    expect(await service.unreadCount(SALES)).toBe(1);
    expect(await service.unreadCount(OTHER)).toBe(1);
  });

  it('menandai semuanya terbaca', async () => {
    await service.notify({ userId: SALES, kind: 'lead_assigned' });
    await service.notify({ userId: SALES, kind: 'report_ready' });
    await service.markRead(SALES, []);
    expect(await service.unreadCount(SALES)).toBe(0);
    expect((await service.list(SALES)).every((row) => row.readAt !== null)).toBe(true);
  });

  it('id orang lain tidak bisa ditandai terbaca', async () => {
    await service.notify({ userId: OTHER, kind: 'lead_assigned' });
    const theirs = (await service.list(OTHER))[0]!;
    await service.markRead(SALES, [theirs.id]);
    expect(await service.unreadCount(OTHER)).toBe(1);
  });

  it('beberapa penerima sekaligus, tanpa ganda', async () => {
    await service.notifyAll([SALES, ADMIN, SALES], { kind: 'contact_requested' });
    expect(await service.unreadCount(SALES)).toBe(1);
    expect(await service.unreadCount(ADMIN)).toBe(1);
  });

  it('kejadian untuk tim pergi ke admin dan peninjau, bukan ke semua akun', async () => {
    await fixture.db.insert(userRoles).values([
      { userId: ADMIN, role: 'admin' },
      { userId: SALES, role: 'sales' },
    ]);
    await service.notifyTeam({ kind: 'contact_requested', subjectId: OTHER });
    expect(await service.unreadCount(ADMIN)).toBe(1);
    expect(await service.unreadCount(SALES)).toBe(0);
    expect(await service.unreadCount(OTHER)).toBe(0);
  });

  it('tanpa penerima: tidak ada baris, bukan galat', async () => {
    await service.notifyTeam({ kind: 'contact_requested' });
    expect(await service.list(ADMIN)).toEqual([]);
  });
});
