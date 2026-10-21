/**
 * P26-06 — dashboard sales di MySQL: sales hanya melihat prospek miliknya, kalah wajib beralasan,
 * ringkasan dari snapshot kebutuhan terakhir, dan transkrip hanya untuk percakapan pelanggan itu.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { userRoles, users } from '../../../infrastructure/mysql/schema/identity.js';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import { salesRequests } from '../../../infrastructure/mysql/schema/intelligence.js';
import { LeadContextWriter } from '../application/lead-context.writer.js';
import { LeadService } from '../application/lead.service.js';
import { ProspectBoardService } from '../application/prospect-board.service.js';
import { LeadNotFoundError, LostReasonRequiredError } from '../domain/lead.js';
import { MysqlLeadStore } from './mysql-lead.store.js';
import { MysqlProspectStore } from './mysql-prospect.store.js';

const BUYER = testId('LBUYER');
const ADMIN = testId('LADMIN');
const SALES = testId('LSALES');
const OTHER_SALES = testId('LSALES2');
const CONV = testId('LCONV');
const OTHER_CONV = testId('LCONVX');

const asSales = { id: SALES, roles: ['sales'] };
const asOtherSales = { id: OTHER_SALES, roles: ['sales'] };
const asAdmin = { id: ADMIN, roles: ['admin'] };

let fixture: TestDatabase;
let leads: LeadService;
let ai: { writeProse: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  fixture = await createTestDatabase('sales_dashboard');
});
afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  ai = { writeProse: vi.fn(async () => ({ text: 'Pelanggan membangun rumah 2 lantai.' })) };
  const board = new ProspectBoardService(new MysqlProspectStore({ db: fixture.db }));
  leads = new LeadService(new MysqlLeadStore({ db: fixture.db }), board, new LeadContextWriter(ai));
  const person = (id: string, email: string, name: string) => ({
    id,
    email,
    passwordHash: 'x'.repeat(60),
    name,
  });
  await fixture.db
    .insert(users)
    .values([
      person(BUYER, 'beli@example.test', 'Pembeli'),
      person(ADMIN, 'adm@example.test', 'Admin'),
      person(SALES, 's1@example.test', 'Sales Satu'),
      person(OTHER_SALES, 's2@example.test', 'Sales Dua'),
    ]);
  await fixture.db.insert(userRoles).values([
    { userId: ADMIN, role: 'admin' },
    { userId: SALES, role: 'sales' },
    { userId: OTHER_SALES, role: 'sales' },
  ]);
  await fixture.db.insert(conversations).values([
    { id: CONV, ownerKind: 'user', ownerId: BUYER, language: 'id', title: 'Rumah 2 lantai' },
    { id: OTHER_CONV, ownerKind: 'user', ownerId: ADMIN, language: 'id' },
  ]);
  await fixture.db.insert(requirementSnapshots).values({
    id: testId('LSNAP'),
    conversationId: CONV,
    version: 1,
    trigger: 'extraction',
    state: {
      building: { type: { value: 'residential' }, floors: { value: 2 } },
      fixtures: { bathrooms: { value: 3 } },
      water: { source: { value: 'rooftop_tank' } },
    },
  });
  await fixture.db.insert(messages).values({
    id: testId('LMSG'),
    conversationId: CONV,
    role: 'user',
    text: 'harga pipa buat rumah 2 lantai berapa?',
    cards: [],
    intent: 'price_question',
  });
  await fixture.db
    .insert(salesRequests)
    .values({ id: testId('LSR'), userId: BUYER, conversationId: CONV, source: 'price' });
  await leads.assign(BUYER, SALES, ADMIN);
});

describe('dashboard sales (P26-06)', () => {
  it('sales melihat prospek miliknya; sales lain tidak — NOT_FOUND, bukan 403', async () => {
    expect((await leads.mine(asSales)).map((r) => r.user.id)).toEqual([BUYER]);
    expect(await leads.mine(asOtherSales)).toEqual([]);
    await expect(leads.detail(BUYER, asOtherSales)).rejects.toBeInstanceOf(LeadNotFoundError);
    await expect(leads.detail(BUYER, asAdmin)).resolves.toBeDefined();
  });

  it('ringkasan dari snapshot terakhir, kutipan pelanggan, dan permintaan kontak', async () => {
    const { facts, prospect } = await leads.detail(BUYER, asSales);
    expect(facts.projects[0]).toMatchObject({
      title: 'Rumah 2 lantai',
      buildingType: 'residential',
      floors: 2,
      bathrooms: 3,
      waterSource: 'rooftop_tank',
    });
    expect(facts.quotes.map((q) => q.text)).toEqual(['harga pipa buat rumah 2 lantai berapa?']);
    expect(facts.salesRequest?.source).toBe('price');
    expect(prospect?.stage).toBe('act');
  });

  it('paragraf konteks tersusun di latar setelah penugasan', async () => {
    await vi.waitFor(async () => {
      const { lead } = await leads.detail(BUYER, asSales);
      expect(lead.context?.text).toBe('Pelanggan membangun rumah 2 lantai.');
    });
  });

  it('status bergerak; kalah wajib beralasan', async () => {
    await leads.setStatus(BUYER, asSales, 'contacted', null);
    expect((await leads.detail(BUYER, asSales)).lead.status).toBe('contacted');
    await expect(leads.setStatus(BUYER, asSales, 'lost', null)).rejects.toBeInstanceOf(
      LostReasonRequiredError,
    );
    await leads.setStatus(BUYER, asSales, 'lost', 'pakai stok toko langganan');
    expect((await leads.detail(BUYER, asSales)).lead).toMatchObject({
      status: 'lost',
      lostReason: 'pakai stok toko langganan',
    });
  });

  it('transkrip hanya untuk percakapan milik pelanggan itu', async () => {
    const lines = await leads.transcript(BUYER, CONV, asSales);
    expect(lines.map((l) => l.text)).toEqual(['harga pipa buat rumah 2 lantai berapa?']);
    await expect(leads.transcript(BUYER, OTHER_CONV, asSales)).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
  });
});
