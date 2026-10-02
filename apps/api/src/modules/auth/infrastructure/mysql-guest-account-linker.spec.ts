/**
 * P3-06a — invarian G-1 terhadap MySQL sungguhan: seluruh percakapan berpindah
 * tanpa kehilangan satu pun, dan tidak ada keadaan di mana percakapan kehilangan
 * pemilik yang bisa menjangkaunya.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { guestSessions, users } from '../../../infrastructure/mysql/schema/identity.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import { MysqlConversationRepository } from '../../conversation/infrastructure/mysql-conversation.repository.js';
import { GuestSessionService } from '../application/guest-session.service.js';
import { MysqlGuestSessionRepository } from './mysql-guest-session.repository.js';
import { MysqlGuestAccountLinker } from './mysql-guest-account-linker.js';

const GUEST_ID = testId('LGUEST');
const USER_ID = testId('LUSER');
const OTHER_USER = testId('LOTHER');

let fixture: TestDatabase;
let linker: MysqlGuestAccountLinker;
let conversationService: ConversationService;
let guestSessionService: GuestSessionService;

beforeAll(async () => {
  fixture = await createTestDatabase('linker');
  linker = new MysqlGuestAccountLinker({ db: fixture.db });
  conversationService = new ConversationService(
    new MysqlConversationRepository({ db: fixture.db }),
  );
  guestSessionService = new GuestSessionService(
    new MysqlGuestSessionRepository({ db: fixture.db }),
    86_400,
  );
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  await fixture.db.insert(users).values([
    { id: USER_ID, email: 'pemilik@example.test', passwordHash: 'x'.repeat(60), name: 'Pemilik' },
    { id: OTHER_USER, email: 'lain@example.test', passwordHash: 'x'.repeat(60), name: 'Lain' },
  ]);
  await fixture.db.insert(guestSessions).values({
    id: GUEST_ID,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
});

const GUEST = { kind: 'guest', id: GUEST_ID } as const;
const USER = { kind: 'user', id: USER_ID } as const;

describe('G-1 — perpindahan utuh', () => {
  it('memindahkan SEMUA percakapan dan menunjuk yang terakhir disentuh', async () => {
    const older = await conversationService.create(GUEST);
    const newer = await conversationService.create(GUEST);
    await conversationService.appendUserMessage(newer.id, GUEST, 'terakhir disentuh');

    const result = await linker.link(GUEST_ID, USER_ID);

    expect(result.movedConversations).toBe(2);
    expect(result.resumedConversationId).toBe(newer.id);
    // Pesan ikut pindah bersama percakapannya — snapshot Fase 4 akan ikut dengan
    // cara yang sama, karena keduanya berkunci conversation_id.
    const messages = await conversationService.messages(newer.id, USER);
    expect(messages).toHaveLength(1);
    expect(await conversationService.list(GUEST, {})).toEqual([]);
    expect((await conversationService.find(older.id, USER)).owner).toEqual(USER);
  });

  it('menandai sesi tertaut dalam transaksi yang sama', async () => {
    await conversationService.create(GUEST);

    await linker.link(GUEST_ID, USER_ID);

    const [session] = await fixture.db
      .select({ linkedUserId: guestSessions.linkedUserId, linkedAt: guestSessions.linkedAt })
      .from(guestSessions)
      .where(eq(guestSessions.id, GUEST_ID));
    expect(session?.linkedUserId).toBe(USER_ID);
    expect(session?.linkedAt).not.toBeNull();
  });

  it('sesi yang tertaut tidak bisa dipakai lagi sebagai tamu', async () => {
    await linker.link(GUEST_ID, USER_ID);

    const ensured = await guestSessionService.ensure(GUEST_ID);

    expect(ensured.id).not.toBe(GUEST_ID);
  });
});

describe('G-1 — penautan yang tidak boleh terjadi', () => {
  it('idempoten: penautan kedua ke user yang sama tidak memindahkan apa pun lagi', async () => {
    await conversationService.create(GUEST);
    await linker.link(GUEST_ID, USER_ID);

    const second = await linker.link(GUEST_ID, USER_ID);

    expect(second).toEqual({ movedConversations: 0, resumedConversationId: null });
  });

  it('cookie yang disalin tidak memindahkan percakapan korban ke akun penyalin', async () => {
    const conversation = await conversationService.create(GUEST);
    await linker.link(GUEST_ID, USER_ID); // korban mendaftar lebih dulu

    const thief = await linker.link(GUEST_ID, OTHER_USER);

    expect(thief.movedConversations).toBe(0);
    expect((await conversationService.find(conversation.id, USER)).owner).toEqual(USER);
  });

  it('sesi kedaluwarsa tidak ditautkan — dan registrasi tidak gagal karenanya', async () => {
    await fixture.db
      .update(guestSessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(guestSessions.id, GUEST_ID));

    const result = await linker.link(GUEST_ID, USER_ID);

    expect(result).toEqual({ movedConversations: 0, resumedConversationId: null });
  });

  it('sesi yang tidak pernah ada: hasil nol, tanpa galat', async () => {
    const result = await linker.link(testId('TIDAKADA'), USER_ID);

    expect(result).toEqual({ movedConversations: 0, resumedConversationId: null });
  });

  it('dua register serentak dengan cookie yang sama: tepat satu yang menautkan', async () => {
    await conversationService.create(GUEST);

    const [first, second] = await Promise.all([
      linker.link(GUEST_ID, USER_ID),
      linker.link(GUEST_ID, OTHER_USER),
    ]);

    const winners = [first, second].filter((result) => result.movedConversations > 0);
    expect(winners).toHaveLength(1);
    const [session] = await fixture.db
      .select({ linkedUserId: guestSessions.linkedUserId })
      .from(guestSessions)
      .where(eq(guestSessions.id, GUEST_ID));
    expect([USER_ID, OTHER_USER]).toContain(session?.linkedUserId);
  });
});
