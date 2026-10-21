/**
 * P3-10a — status hanya dari enum; riwayat terurut `updated_at DESC`; dan
 * kepemilikan yang diperiksa di lapisan application benar-benar menolak.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { eq } from 'drizzle-orm';
import { conversations, messages } from '../../../infrastructure/mysql/schema/conversation.js';
import type { ConversationOwner } from '../domain/conversation.repository.js';
import { ConversationNotFoundError, EmptyMessageError } from '../domain/conversation.errors.js';
import { ConversationService } from '../application/conversation.service.js';
import { MysqlConversationRepository } from './mysql-conversation.repository.js';

const GUEST: ConversationOwner = { kind: 'guest', id: testId('CGUEST') };
const OTHER: ConversationOwner = { kind: 'guest', id: testId('COTHER') };

let fixture: TestDatabase;
let service: ConversationService;
let repository: MysqlConversationRepository;

beforeAll(async () => {
  fixture = await createTestDatabase('conversations');
  repository = new MysqlConversationRepository({ db: fixture.db });
  service = new ConversationService(repository);
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
});

describe('percakapan — pembuatan dan daftar', () => {
  it('lahir IN_PROGRESS di tahap KEBUTUHAN, tanpa judul', async () => {
    const row = await service.create(GUEST);

    expect(row.status).toBe('IN_PROGRESS');
    expect(row.stage).toBe('KEBUTUHAN');
    expect(row.title).toBeNull();
  });

  it('bahasa percakapan tersimpan (0019): baku id, en bila diminta; nilai lain ditolak database', async () => {
    const id = await service.create(GUEST);
    expect(id.language).toBe('id');
    const en = await service.create(GUEST, 'en');
    expect(en.language).toBe('en');
    expect((await service.find(en.id, GUEST)).language).toBe('en');
    await expect(
      repository.create({ id: 'X'.repeat(26), owner: GUEST, language: 'jv' as never }),
    ).rejects.toThrow();
  });

  it('mengurutkan riwayat dari yang terakhir diperbarui', async () => {
    const first = await service.create(GUEST);
    const second = await service.create(GUEST);
    // Menyentuh yang pertama menaikkannya ke atas.
    await service.appendUserMessage(first.id, GUEST, 'halo');

    const listed = await service.list(GUEST, {});

    expect(listed.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it('menolak status di luar enum di lapisan database', async () => {
    await expect(
      fixture.db.insert(conversations).values({
        id: testId('CBAD'),
        ownerKind: 'guest',
        ownerId: GUEST.id,
        status: 'MENGAMBANG',
      }),
    ).rejects.toThrow();
  });

  it('memfilter status dan pencarian judul', async () => {
    const conversation = await service.create(GUEST);
    await service.rename(conversation.id, GUEST, 'Instalasi rumah dua lantai');
    await service.create(GUEST);

    const byTitle = await service.list(GUEST, { q: 'dua lantai' });
    const byStatus = await service.list(GUEST, { status: 'SAVED' });

    expect(byTitle.map((row) => row.id)).toEqual([conversation.id]);
    expect(byStatus).toEqual([]);
  });
});

describe('percakapan — kepemilikan di lapisan application', () => {
  it('menjawab NOT_FOUND untuk percakapan milik aktor lain — bukan 403', async () => {
    const theirs = await service.create(GUEST);

    await expect(service.find(theirs.id, OTHER)).rejects.toThrow(ConversationNotFoundError);
    await expect(service.messages(theirs.id, OTHER)).rejects.toThrow(ConversationNotFoundError);
    await expect(service.rename(theirs.id, OTHER, 'curian')).rejects.toThrow(
      ConversationNotFoundError,
    );
  });

  it('membedakan jenis pemilik: user dengan id yang sama bukan pemiliknya', async () => {
    const asGuest = await service.create(GUEST);

    await expect(service.find(asGuest.id, { kind: 'user', id: GUEST.id })).rejects.toThrow(
      ConversationNotFoundError,
    );
  });

  it('yang dihapus terlihat terhapus — find sesudah remove menjawab NOT_FOUND', async () => {
    const mine = await service.create(GUEST);
    await service.remove(mine.id, GUEST);

    await expect(service.find(mine.id, GUEST)).rejects.toThrow(ConversationNotFoundError);
    expect(await service.list(GUEST, {})).toEqual([]);
  });

  it('"Urungkan": restore mengembalikan percakapan ke riwayat; hanya pemiliknya; idempoten', async () => {
    const mine = await service.create(GUEST);
    await service.remove(mine.id, GUEST);

    await expect(service.restore(mine.id, OTHER)).rejects.toThrow(ConversationNotFoundError);
    expect(await service.list(GUEST, {})).toEqual([]);

    await service.restore(mine.id, GUEST);
    await service.restore(mine.id, GUEST);
    expect((await service.list(GUEST, {})).map((c) => c.id)).toEqual([mine.id]);
    expect((await service.find(mine.id, GUEST)).id).toBe(mine.id);
  });
});

describe('pesan', () => {
  it('menolak pesan kosong dan judul kosong', async () => {
    const mine = await service.create(GUEST);

    await expect(service.appendUserMessage(mine.id, GUEST, '   ')).rejects.toThrow(
      EmptyMessageError,
    );
    await expect(service.rename(mine.id, GUEST, '  ')).rejects.toThrow(EmptyMessageError);
  });

  it('mengurutkan pesan sesuai waktu, dan kartu asisten kembali utuh', async () => {
    const mine = await service.create(GUEST);
    await service.appendUserMessage(mine.id, GUEST, 'butuh pipa untuk rumah 2 lantai');
    await service.appendAssistantMessage(
      mine.id,
      'Baik, saya catat.',
      [{ kind: 'cta', action: 'ANALYZE' }],
      'write',
    );

    const rows = await service.messages(mine.id, GUEST);

    expect(rows.map((row) => row.role)).toEqual(['user', 'assistant']);
    expect(rows[1]?.cards).toEqual([{ kind: 'cta', action: 'ANALYZE' }]);
    expect(rows[1]?.mood).toBe('write');
  });
});

describe('simpan solusi (P8-01)', () => {
  it('menyimpan mengubah status ke SAVED dan tahap ke SOLUSI', async () => {
    const owner = { kind: 'user' as const, id: testId('user') };
    const created = await service.create(owner);
    await service.save(created.id, owner);

    const after = await service.find(created.id, owner);
    expect(after.status).toBe('SAVED');
    // Status dan tahap bergerak bersama — header layar tidak boleh bertentangan
    // dengan isinya.
    expect(after.stage).toBe('SOLUSI');
  });

  it('tidak bisa menyimpan percakapan orang lain', async () => {
    const owner = { kind: 'user' as const, id: testId('user') };
    const other = { kind: 'user' as const, id: testId('other') };
    const created = await service.create(owner);
    await expect(service.save(created.id, other)).rejects.toThrow();
  });

  it('markSolutionReady menandai solusi siap tanpa memeriksa pemilik (pemanggilnya sistem)', async () => {
    const owner = { kind: 'guest' as const, id: testId('guest') };
    const created = await service.create(owner);
    await service.markSolutionReady(created.id);

    const after = await service.find(created.id, owner);
    expect(after.status).toBe('SOLUTION_READY');
    expect(after.stage).toBe('SOLUSI');
  });
});

describe('sematan dan proyek di MySQL (P24-01/02, 0025)', () => {
  it('sematan tidak mengubah urutan riwayat; daftar sematan terpisah; proyek memfilter', async () => {
    const owner = { kind: 'user' as const, id: testId('user') };
    const first = await service.create(owner);
    const second = await service.create(owner);
    await service.appendUserMessage(second.id, owner, 'halo');
    const before = (await service.list(owner, {})).map((r) => r.id);
    await repository.setPinned(first.id, true);
    expect((await service.list(owner, {})).map((r) => r.id)).toEqual(before);
    const pinned = await service.list(owner, { pinned: true });
    expect(pinned.map((r) => r.id)).toEqual([first.id]);
    expect(pinned[0]!.pinnedAt).toBeInstanceOf(Date);
    const projectId = testId('PROJ');
    await repository.setProject(second.id, projectId);
    expect((await service.list(owner, { projectId })).map((r) => r.id)).toEqual([second.id]);
    await repository.setProject(second.id, null);
    expect(await service.list(owner, { projectId })).toEqual([]);
  });
});

describe('bahasa percakapan di MySQL (P25-01)', () => {
  it('bahasa tersimpan tanpa mengubah urutan riwayat', async () => {
    const owner = { kind: 'user' as const, id: testId('user') };
    const first = await service.create(owner, 'id');
    const second = await service.create(owner, 'id');
    await service.appendUserMessage(second.id, owner, 'halo');
    const before = (await service.list(owner, {})).map((r) => r.id);
    await repository.setLanguage(first.id, 'en');
    expect((await service.find(first.id, owner)).language).toBe('en');
    expect((await service.list(owner, {})).map((r) => r.id)).toEqual(before);
  });
});

describe('label intent pesan di MySQL (P26-02, 0026)', () => {
  it('pesan pengguna menyimpan label pemahaman — saat ditulis atau sesudahnya', async () => {
    const conversation = await service.create(GUEST);
    const card = await service.appendUserMessage(
      conversation.id,
      GUEST,
      '2 lantai',
      'clarification_answer',
    );
    const typed = await service.appendUserMessage(conversation.id, GUEST, 'harga pipa 4 inch?');
    await service.tagIntent(typed.id, 'price_question');

    const rows = await fixture.db
      .select({ id: messages.id, intent: messages.intent })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));
    const intentOf = (id: string) => rows.find((r) => r.id === id)?.intent;
    expect(intentOf(card.id)).toBe('clarification_answer');
    expect(intentOf(typed.id)).toBe('price_question');
  });
});
