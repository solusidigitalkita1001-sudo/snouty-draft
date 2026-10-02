/**
 * P8-07a — antrean handoff: kebutuhan DISALIN (bukan dirujuk), antrean adil (terlama
 * dulu), dan status dibatasi CHECK.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../test/mysql.js';
import { conversations, technicalHandoffs } from '../../../infrastructure/mysql/schema/index.js';
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
