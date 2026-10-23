/**
 * Peran `sales` melihat ringkasan percakapan user dengan SNOUTY (P27-08, pemilik 2026-10-23:
 * "role sales belum di testing untuk melihat summary chat antara user dan snouty").
 *
 * Tes P26-06 memeriksa `LeadService` langsung. Yang belum pernah diuji adalah JALUR PERANNYA:
 * penjaga rute, aktor internal, bentuk respons controller, dan apa yang benar-benar sampai ke
 * layar sales. Di sinilah hal itu dipaku — dengan MySQL sungguhan, controller sungguhan, dan
 * `InternalRoleGuard` sungguhan; yang dipalsukan hanya model (paragraf konteks) dan siapa yang
 * sudah masuk.
 */
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { userRoles, users } from '../../../infrastructure/mysql/schema/identity.js';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import { salesRequests } from '../../../infrastructure/mysql/schema/intelligence.js';
import { NotEntitledError, UnauthenticatedError } from '../../../shared/http/api-errors.js';
import {
  InternalRoleGuard,
  type WithInternalActor,
} from '../../../shared/http/internal-role.guard.js';
import { LeadContextWriter } from '../application/lead-context.writer.js';
import { LeadService } from '../application/lead.service.js';
import { ProspectBoardService } from '../application/prospect-board.service.js';
import { LeadNotFoundError } from '../domain/lead.js';
import { MysqlLeadStore } from '../infrastructure/mysql-lead.store.js';
import { MysqlProspectStore } from '../infrastructure/mysql-prospect.store.js';
import { InternalLeadController } from './internal-lead.controller.js';

const BUYER = testId('RBUYER');
const ADMIN = testId('RADMIN');
const SALES = testId('RSALES');
const OTHER_SALES = testId('RSALES2');
const OUTSIDER = testId('ROUT');
const CONV = testId('RCONV');

let fixture: TestDatabase;
let controller: InternalLeadController;
let leads: LeadService;

/** Request seperti yang sudah dilewati modul auth — hanya aktornya yang dipalsukan. */
const asRole = (id: string, roles: readonly string[]): WithInternalActor => ({
  internalActor: { id, roles },
});
const SALES_REQ = asRole(SALES, ['sales']);
const OTHER_SALES_REQ = asRole(OTHER_SALES, ['sales']);
const ADMIN_REQ = asRole(ADMIN, ['admin']);

/** Menjalankan penjaga rute persis seperti Nest menjalankannya untuk sebuah handler. */
function guardFor(handlerName: keyof InternalLeadController, request: WithInternalActor): boolean {
  const guard = new InternalRoleGuard(new Reflector());
  return guard.canActivate({
    getHandler: () => InternalLeadController.prototype[handlerName],
    getClass: () => InternalLeadController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never);
}

beforeAll(async () => {
  fixture = await createTestDatabase('sales_role');
});
afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
  const ai = {
    writeProse: vi.fn(async (): Promise<unknown> => ({
      text: 'Pelanggan sedang membangun rumah dua lantai dan sudah menanyakan harga.',
    })),
  };
  const board = new ProspectBoardService(new MysqlProspectStore({ db: fixture.db }));
  leads = new LeadService(new MysqlLeadStore({ db: fixture.db }), board, new LeadContextWriter(ai));
  controller = new InternalLeadController(leads);

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
      person(OUTSIDER, 'luar@example.test', 'Pengguna Biasa'),
    ]);
  await fixture.db.insert(userRoles).values([
    { userId: ADMIN, role: 'admin' },
    { userId: SALES, role: 'sales' },
    { userId: OTHER_SALES, role: 'sales' },
  ]);
  await fixture.db.insert(conversations).values({
    id: CONV,
    ownerKind: 'user',
    ownerId: BUYER,
    language: 'id',
    title: 'Rumah 2 lantai di Cibinong',
  });
  await fixture.db.insert(requirementSnapshots).values({
    id: testId('RSNAP'),
    conversationId: CONV,
    version: 1,
    trigger: 'extraction',
    state: {
      building: { type: { value: 'residential' }, floors: { value: 2 } },
      fixtures: { bathrooms: { value: 3 } },
      water: { source: { value: 'municipal' } },
    },
  });
  // Percakapan yang sesungguhnya: dua giliran pengguna, dua jawaban SNOUTY, berurutan.
  await fixture.db.insert(messages).values([
    {
      id: testId('RM1'),
      conversationId: CONV,
      role: 'user',
      text: 'mau bangun rumah 2 lantai, 3 kamar mandi, sumber PDAM',
      cards: [],
      intent: 'requirement_building',
    },
    {
      id: testId('RM2'),
      conversationId: CONV,
      role: 'assistant',
      text: 'Pipa utamanya 1 inci dan cabangnya 3/4 inci.',
      cards: [],
    },
    {
      id: testId('RM3'),
      conversationId: CONV,
      role: 'user',
      text: 'harganya berapa ya kalau beli semuanya?',
      cards: [],
      intent: 'price_question',
    },
    {
      id: testId('RM4'),
      conversationId: CONV,
      role: 'assistant',
      text: 'Untuk harga, tim Pralon yang bisa membantu.',
      cards: [],
    },
  ]);
  await fixture.db
    .insert(salesRequests)
    .values({ id: testId('RSR'), userId: BUYER, conversationId: CONV, source: 'price' });
  await leads.assign(BUYER, SALES, ADMIN);
});

describe('penjaga rute: siapa yang boleh membuka dashboard sales', () => {
  it('peran sales lolos ke daftar, ringkasan, status, dan transkrip', () => {
    for (const handler of ['mine', 'detail', 'status', 'transcript'] as const) {
      expect(guardFor(handler, SALES_REQ), handler).toBe(true);
    }
  });

  it('admin dan peninjau lolos juga', () => {
    expect(guardFor('mine', ADMIN_REQ)).toBe(true);
    expect(guardFor('mine', asRole(ADMIN, ['sales_reviewer']))).toBe(true);
  });

  it('akun biasa ditolak, bukan dibiarkan lewat', () => {
    expect(() => guardFor('mine', asRole(OUTSIDER, []))).toThrow(NotEntitledError);
    expect(() => guardFor('detail', asRole(OUTSIDER, ['technical_team']))).toThrow(
      NotEntitledError,
    );
  });

  it('tanpa akun: gagal tertutup', () => {
    expect(() => guardFor('mine', {})).toThrow(UnauthenticatedError);
  });
});

describe('sales membuka ringkasan percakapan user dengan SNOUTY', () => {
  it('daftar prospeknya sendiri; prospek sales lain tidak ada di sana', async () => {
    expect((await controller.mine(SALES_REQ)).items.map((row) => row.userId)).toEqual([BUYER]);
    expect((await controller.mine(OTHER_SALES_REQ)).items).toEqual([]);
  });

  it('ringkasannya memuat kebutuhan, kalimat pelanggan, dan dasar kontaknya', async () => {
    const detail = await controller.detail({ id: BUYER }, SALES_REQ);
    expect(detail.status).toBe('new');
    expect(detail.facts.projects[0]).toMatchObject({
      title: 'Rumah 2 lantai di Cibinong',
      buildingType: 'residential',
      floors: 2,
      bathrooms: 3,
      waterSource: 'municipal',
    });
    // Kalimat pelanggan yang terakhir, bukan jawaban SNOUTY.
    expect(detail.facts.quotes.map((q) => q.text)).toContain(
      'harganya berapa ya kalau beli semuanya?',
    );
    expect(detail.facts.quotes.every((q) => !q.text.startsWith('Pipa utamanya'))).toBe(true);
    expect(detail.facts.salesRequest).toMatchObject({ source: 'price' });
    expect(detail.prospect?.stage).toBe('act');
  });

  it('paragraf konteks dari model menyusul di latar, dan bisa disusun ulang', async () => {
    await vi.waitFor(async () => {
      const detail = await controller.detail({ id: BUYER }, SALES_REQ);
      expect(detail.context?.text).toContain('rumah dua lantai');
    });
    const again = await controller.context({ id: BUYER }, SALES_REQ);
    expect(again.context?.text).toContain('rumah dua lantai');
  });

  it('transkrip penuh: giliran pengguna dan SNOUTY, berurutan, dengan waktunya', async () => {
    const { items } = await controller.transcript({ id: BUYER, conversationId: CONV }, SALES_REQ);
    expect(items.map((line) => line.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(items[0]?.text).toBe('mau bangun rumah 2 lantai, 3 kamar mandi, sumber PDAM');
    expect(items[3]?.text).toBe('Untuk harga, tim Pralon yang bisa membantu.');
    for (const line of items) expect(Number.isNaN(Date.parse(line.at))).toBe(false);
  });

  it('sales lain: prospek itu NOT_FOUND — keberadaannya pun bukan urusannya', async () => {
    await expect(controller.detail({ id: BUYER }, OTHER_SALES_REQ)).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
    await expect(
      controller.transcript({ id: BUYER, conversationId: CONV }, OTHER_SALES_REQ),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it('admin melihat ringkasan yang sama dari papannya', async () => {
    const detail = await controller.detail({ id: BUYER }, ADMIN_REQ);
    expect(detail.facts.projects[0]?.floors).toBe(2);
  });

  it('status bergerak dari layar sales; kalah tanpa alasan ditolak', async () => {
    await controller.status({ id: BUYER }, { status: 'contacted' }, SALES_REQ);
    expect((await controller.detail({ id: BUYER }, SALES_REQ)).status).toBe('contacted');
    await expect(
      controller.status({ id: BUYER }, { status: 'lost' }, SALES_REQ),
    ).rejects.toBeTruthy();
    await controller.status(
      { id: BUYER },
      { status: 'lost', lostReason: 'sudah beli di toko langganan' },
      SALES_REQ,
    );
    const after = await controller.detail({ id: BUYER }, SALES_REQ);
    expect(after).toMatchObject({ status: 'lost', lostReason: 'sudah beli di toko langganan' });
  });

  it('status yang bukan status ditolak sebelum menyentuh database', async () => {
    await expect(
      controller.status({ id: BUYER }, { status: 'menang-banget' }, SALES_REQ),
    ).rejects.toBeTruthy();
  });
});

describe('penugasan memberi tahu sales yang bersangkutan (P27-07)', () => {
  it('kejadiannya ditujukan ke sales itu, dengan prospeknya sebagai rujukan', async () => {
    const notify = vi.fn(async () => undefined);
    const board = new ProspectBoardService(new MysqlProspectStore({ db: fixture.db }), {
      notify,
      notifyAll: vi.fn(async () => undefined),
    });
    const service = new LeadService(
      new MysqlLeadStore({ db: fixture.db }),
      board,
      new LeadContextWriter(null),
    );
    await service.assign(BUYER, OTHER_SALES, ADMIN);
    expect(notify).toHaveBeenCalledWith({
      userId: OTHER_SALES,
      kind: 'lead_assigned',
      subjectId: BUYER,
    });
  });
});

/**
 * P27-09 — pemilik 2026-10-23: "CRM mengenai prospek harus di dalemin lebih lanjut". Yang dulu
 * tercatat hanya status SEKARANG; sekarang ada jejaknya dan jadwal menengok lagi.
 */
describe('jejak tindak lanjut dan jadwal menengok', () => {
  it('penugasan sendiri sudah menjadi baris pertama jejaknya', async () => {
    const { items } = await controller.activity({ id: BUYER }, SALES_REQ);
    expect(items.map((row) => row.kind)).toEqual(['assigned']);
    expect(items[0]?.actorName).toBe('Admin');
  });

  it('catatan sales tercatat dengan nama pencatat dan waktunya, terbaru dulu', async () => {
    await controller.note(
      { id: BUYER },
      { note: 'Sudah ditelepon, minta penawaran 3 ukuran.' },
      SALES_REQ,
    );
    await controller.note({ id: BUYER }, { note: 'Penawaran dikirim lewat WhatsApp.' }, SALES_REQ);
    const { items } = await controller.activity({ id: BUYER }, SALES_REQ);
    expect(items.slice(0, 2).map((row) => row.note)).toEqual([
      'Penawaran dikirim lewat WhatsApp.',
      'Sudah ditelepon, minta penawaran 3 ukuran.',
    ]);
    expect(items[0]).toMatchObject({ kind: 'note', actorName: 'Sales Satu' });
    expect(Number.isNaN(Date.parse(items[0]!.at))).toBe(false);
  });

  it('catatan kosong ditolak', async () => {
    await expect(controller.note({ id: BUYER }, { note: '   ' }, SALES_REQ)).rejects.toBeTruthy();
  });

  it('perubahan status ikut ke jejak, lengkap dengan alasan kalahnya', async () => {
    await controller.status({ id: BUYER }, { status: 'contacted' }, SALES_REQ);
    await controller.status(
      { id: BUYER },
      { status: 'lost', lostReason: 'harga belum cocok' },
      SALES_REQ,
    );
    const { items } = await controller.activity({ id: BUYER }, SALES_REQ);
    const statuses = items.filter((row) => row.kind === 'status');
    expect(statuses.map((row) => row.status)).toEqual(['lost', 'contacted']);
    expect(statuses[0]?.note).toBe('harga belum cocok');
  });

  it('jadwal menengok tersimpan di prospeknya dan tercatat di jejak; null menghapusnya', async () => {
    const at = '2026-11-02T03:00:00.000Z';
    await controller.followUp({ id: BUYER }, { at }, SALES_REQ);
    expect((await controller.detail({ id: BUYER }, SALES_REQ)).followUpAt).toBe(at);
    const { items } = await controller.activity({ id: BUYER }, SALES_REQ);
    expect(items[0]).toMatchObject({ kind: 'follow_up', followUpAt: at });

    await controller.followUp({ id: BUYER }, { at: null }, SALES_REQ);
    expect((await controller.detail({ id: BUYER }, SALES_REQ)).followUpAt).toBeNull();
  });

  it('sales lain tidak bisa mencatat, menjadwalkan, atau membaca jejaknya', async () => {
    await expect(
      controller.note({ id: BUYER }, { note: 'coba-coba' }, OTHER_SALES_REQ),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
    await expect(
      controller.followUp({ id: BUYER }, { at: null }, OTHER_SALES_REQ),
    ).rejects.toBeInstanceOf(LeadNotFoundError);
    await expect(controller.activity({ id: BUYER }, OTHER_SALES_REQ)).rejects.toBeInstanceOf(
      LeadNotFoundError,
    );
  });

  it('penjaga rute melindungi jalur baru juga', () => {
    for (const handler of ['activity', 'note', 'followUp'] as const) {
      expect(guardFor(handler, SALES_REQ), handler).toBe(true);
      expect(() => guardFor(handler, asRole(OUTSIDER, []))).toThrow(NotEntitledError);
    }
  });
});
