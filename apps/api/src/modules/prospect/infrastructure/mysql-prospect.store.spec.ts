/**
 * P26-05 — papan prospek di MySQL: staf bukan prospek, tahap dari jejak nyata, izin terbaru menang,
 * penugasan hanya bila ada dasar kontak, dan tim sales dikelola lewat email.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { consents, userRoles, users } from '../../../infrastructure/mysql/schema/identity.js';
import { conversations, messages } from '../../../infrastructure/mysql/schema/conversation.js';
import { salesLeads, salesRequests } from '../../../infrastructure/mysql/schema/intelligence.js';
import { ProspectBoardService } from '../application/prospect-board.service.js';
import { NotContactableError, NotSalesError } from '../domain/prospect-board.js';
import { MysqlProspectStore } from './mysql-prospect.store.js';

const BUYER = testId('BUYER');
const BROWSER = testId('BROWSER');
const ADMIN = testId('ADMIN');
const SALES = testId('SALES');
const CONV = testId('CONVBUYER');

let fixture: TestDatabase;
let store: MysqlProspectStore;
let board: ProspectBoardService;

beforeAll(async () => {
  fixture = await createTestDatabase('prospect_board');
  store = new MysqlProspectStore({ db: fixture.db });
  board = new ProspectBoardService(store);
});
afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  const person = (id: string, email: string, name: string) => ({
    id,
    email,
    passwordHash: 'x'.repeat(60),
    name,
  });
  await fixture.db
    .insert(users)
    .values([
      person(BUYER, 'pembeli@example.test', 'Pembeli'),
      person(BROWSER, 'lihat@example.test', 'Pelihat'),
      person(ADMIN, 'admin@example.test', 'Admin'),
      person(SALES, 'sales@example.test', 'Sales Satu'),
    ]);
  await fixture.db.insert(userRoles).values({ userId: ADMIN, role: 'admin' });
  await fixture.db
    .insert(conversations)
    .values({ id: CONV, ownerKind: 'user', ownerId: BUYER, language: 'id' });
  await fixture.db.insert(messages).values({
    id: testId('MSG1'),
    conversationId: CONV,
    role: 'user',
    text: 'harga pipa 4 inch?',
    cards: [],
    intent: 'price_question',
  });
});

describe('papan prospek (P26-05)', () => {
  it('staf internal bukan prospek; tahap dari label pesan', async () => {
    const result = await board.board({});
    const ids = result.items.map((row) => row.user.id);
    expect(ids).toContain(BUYER);
    expect(ids).toContain(BROWSER);
    expect(ids).not.toContain(ADMIN);
    const buyer = result.items.find((row) => row.user.id === BUYER)!;
    expect(buyer).toMatchObject({ stage: 'ask', conversationCount: 1, contactable: false });
    expect(result.funnel.ask).toBe(1);
    expect(result.funnel.aware).toBe(2); // pembeli tanpa percakapan + sales (belum berperan)
  });

  it('izin TERAKHIR yang berlaku: menolak setelah setuju = tidak bisa dihubungi', async () => {
    await fixture.db.insert(consents).values([
      {
        id: testId('C1'),
        subjectId: BUYER,
        subjectKind: 'user',
        kind: 'SALES_CONTACT',
        granted: 1,
        policyVersion: 'v1',
      },
      {
        id: testId('C2'),
        subjectId: BUYER,
        subjectKind: 'user',
        kind: 'SALES_CONTACT',
        granted: 0,
        policyVersion: 'v1',
      },
    ]);
    const buyer = (await board.board({})).items.find((row) => row.user.id === BUYER)!;
    expect(buyer.salesContactConsent).toBe(false);
    await expect(board.assign(BUYER, SALES, ADMIN)).rejects.toBeInstanceOf(NotContactableError);
  });

  it('minta dihubungi = Act dan boleh ditugaskan; hanya ke anggota tim sales; dipindah, bukan digandakan', async () => {
    await fixture.db
      .insert(salesRequests)
      .values({ id: testId('SR1'), userId: BUYER, conversationId: CONV, source: 'price' });
    const buyer = (await board.board({})).items.find((row) => row.user.id === BUYER)!;
    expect(buyer).toMatchObject({ stage: 'act', contactable: true, lead: null });

    await expect(board.assign(BUYER, SALES, ADMIN)).rejects.toBeInstanceOf(NotSalesError);
    await board.addSales('SALES@example.test', ADMIN);
    await board.assign(BUYER, SALES, ADMIN);
    await board.assign(BUYER, SALES, ADMIN);

    expect(await fixture.db.select().from(salesLeads)).toHaveLength(1);
    const assigned = await board.board({ assignment: 'assigned' });
    expect(assigned.items.map((row) => row.user.id)).toEqual([BUYER]);
    expect(assigned.items[0]!.lead).toMatchObject({ salesName: 'Sales Satu', status: 'new' });
    // Sales kini staf: tidak lagi muncul sebagai prospek.
    expect((await board.board({})).items.map((row) => row.user.id)).not.toContain(SALES);
  });

  it('tim sales: jumlah prospek terbuka, dan dicabut lewat id', async () => {
    await fixture.db
      .insert(salesRequests)
      .values({ id: testId('SR2'), userId: BUYER, conversationId: CONV, source: 'solution' });
    await board.addSales('sales@example.test', ADMIN);
    await board.assign(BUYER, SALES, ADMIN);
    expect(await board.salesTeam()).toEqual([
      { id: SALES, name: 'Sales Satu', email: 'sales@example.test', openLeads: 1 },
    ]);
    await board.removeSales(SALES);
    expect(await board.salesTeam()).toEqual([]);
  });

  it('email yang tidak terdaftar ditolak', async () => {
    await expect(board.addSales('tidak.ada@example.test', ADMIN)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
