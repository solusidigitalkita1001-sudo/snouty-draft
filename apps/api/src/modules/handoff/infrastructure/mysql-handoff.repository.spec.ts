/**
 * P8-07a — antrean handoff: kebutuhan DISALIN (bukan dirujuk), antrean adil (terlama
 * dulu), dan status dibatasi CHECK.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../test/mysql.js';
import {
  conversations,
  technicalHandoffs,
  users,
} from '../../../infrastructure/mysql/schema/index.js';
import { ulid } from '../../../shared/ulid.js';
import { MysqlHandoffRepository } from './mysql-handoff.repository.js';

const mysql = await createTestDatabase('handoffs');
const repository = new MysqlHandoffRepository({ db: mysql.db } as never);

async function newConversation(): Promise<string> {
  const id = ulid();
  await mysql.db.insert(conversations).values({ id, ownerKind: 'guest', ownerId: ulid() });
  return id;
}

beforeEach(() => mysql.clear());
afterAll(() => mysql.close());

describe('antrean handoff teknis', () => {
  it('menyimpan alasan dan kebutuhan terkumpul, status QUEUED', async () => {
    const conversationId = await newConversation();
    const row = await repository.enqueue({
      id: ulid(),
      conversationId,
      reason: 'Instalasi industri memerlukan pemeriksaan tim teknis Pralon.',
      captured: [
        { label: 'building.floors', value: '2' },
        { label: 'fixtures.bathrooms', value: '3' },
      ],
    });

    expect(row.status).toBe('QUEUED');
    expect(row.captured).toHaveLength(2);
    expect(row.assignedTo).toBeNull();
    expect(row.resolvedAt).toBeNull();
  });

  it('kebutuhan disalin — mengubah percakapan tidak mengubah isi handoff', async () => {
    const conversationId = await newConversation();
    const row = await repository.enqueue({
      id: ulid(),
      conversationId,
      reason: 'alasan',
      captured: [{ label: 'building.floors', value: '2' }],
    });
    // Tidak ada jalur dari handoff ke snapshot: isinya memang salinan beku.
    const read = await repository.findById(row.id);
    expect(read?.captured).toEqual([{ label: 'building.floors', value: '2' }]);
  });

  it('antrean mengembalikan yang terlama dulu — urutan yang adil', async () => {
    const a = await newConversation();
    const b = await newConversation();
    const first = await repository.enqueue({
      id: ulid(),
      conversationId: a,
      reason: 'pertama',
      captured: [],
    });
    const second = await repository.enqueue({
      id: ulid(),
      conversationId: b,
      reason: 'kedua',
      captured: [],
    });

    const queue = await repository.listQueued();
    expect(queue.map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it('CHECK menolak status di luar daftar', async () => {
    const conversationId = await newConversation();
    await expect(
      mysql.db.insert(technicalHandoffs).values({
        id: ulid(),
        conversationId,
        reason: 'alasan',
        capturedJson: [],
        status: 'MENUNGGU',
      }),
    ).rejects.toThrow();
  });

  it('menghapus percakapan menghapus handoff-nya (cascade)', async () => {
    const conversationId = await newConversation();
    await repository.enqueue({ id: ulid(), conversationId, reason: 'alasan', captured: [] });
    await mysql.db.delete(conversations);
    expect(await mysql.db.select().from(technicalHandoffs)).toHaveLength(0);
  });

  it('handoff sebuah percakapan bisa dibaca kembali seluruhnya', async () => {
    const conversationId = await newConversation();
    await repository.enqueue({ id: ulid(), conversationId, reason: 'satu', captured: [] });
    await repository.enqueue({ id: ulid(), conversationId, reason: 'dua', captured: [] });
    expect(await repository.findForConversation(conversationId)).toHaveLength(2);
  });
});

/**
 * P29-01a — antrean yang dibaca layar back-office: yang belum selesai, yang sudah ditutup,
 * perpindahan status, dan kontak orang yang menyerahkannya.
 */
describe('antrean teknis di back-office', () => {
  async function newUserConversation(email: string): Promise<string> {
    const userId = ulid();
    await mysql.db.insert(users).values({
      id: userId,
      email,
      passwordHash: 'x',
      name: 'Pengguna Uji',
      phone: '+6281234567890',
    });
    const id = ulid();
    await mysql.db.insert(conversations).values({ id, ownerKind: 'user', ownerId: userId });
    return id;
  }

  it('yang belum selesai memuat yang sudah diambil, bukan hanya yang masih mengantre', async () => {
    const queued = await repository.enqueue({
      id: ulid(),
      conversationId: await newConversation(),
      reason: 'mengantre',
      captured: [],
    });
    const taken = await repository.enqueue({
      id: ulid(),
      conversationId: await newConversation(),
      reason: 'diambil',
      captured: [],
    });
    await repository.setStatus(taken.id, 'IN_REVIEW', ulid());

    const open = await repository.listOpen();
    expect(open.map((row) => row.id).sort()).toEqual([queued.id, taken.id].sort());
  });

  it('kasus yang ditutup pindah ke daftar tertutup, dengan waktu penutupannya', async () => {
    const row = await repository.enqueue({
      id: ulid(),
      conversationId: await newConversation(),
      reason: 'selesai',
      captured: [],
    });
    const resolved = await repository.setStatus(row.id, 'RESOLVED', null);

    expect(resolved.resolvedAt).not.toBeNull();
    expect(await repository.listOpen()).toHaveLength(0);
    expect((await repository.listClosed()).map((r) => r.id)).toEqual([row.id]);
  });

  it('membuka kembali kasus menghapus stempel penutupannya', async () => {
    const row = await repository.enqueue({
      id: ulid(),
      conversationId: await newConversation(),
      reason: 'dibuka lagi',
      captured: [],
    });
    await repository.setStatus(row.id, 'RESOLVED', null);
    const reopened = await repository.setStatus(row.id, 'QUEUED', null);

    expect(reopened.resolvedAt).toBeNull();
    expect(await repository.listClosed()).toHaveLength(0);
  });

  it('kontak pengguna terdaftar ikut, supaya kasusnya bisa dijawab', async () => {
    await repository.enqueue({
      id: ulid(),
      conversationId: await newUserConversation('teknis@example.test'),
      reason: 'punya kontak',
      captured: [],
    });

    const [row] = await repository.listOpen();
    expect(row?.submitter).toEqual({
      name: 'Pengguna Uji',
      email: 'teknis@example.test',
      phone: '+6281234567890',
    });
  });

  it('kasus dari tamu tetap muncul, tanpa kontak', async () => {
    await repository.enqueue({
      id: ulid(),
      conversationId: await newConversation(),
      reason: 'tamu',
      captured: [],
    });

    const [row] = await repository.listOpen();
    expect(row?.submitter).toBeNull();
  });
});
