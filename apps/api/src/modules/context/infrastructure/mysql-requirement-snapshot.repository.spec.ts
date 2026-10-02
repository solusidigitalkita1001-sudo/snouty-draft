/**
 * P4-06a — snapshot append-only, version monoton (CONTEXT_ENGINE §9 #5),
 * dan write-through: cache miss dilayani MySQL. Terhadap MySQL + Redis nyata.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { conversations } from '../../../infrastructure/mysql/schema/conversation.js';
import { ulid } from '../../../shared/ulid.js';
import { createTestDatabase } from '../../../../test/mysql.js';
import { createTestRedis } from '../../../../test/redis.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import { mergeRequirement } from '../domain/context-merger.js';
import { MysqlRequirementSnapshotRepository } from './mysql-requirement-snapshot.repository.js';
import { RequirementSnapshotStore } from '../application/requirement-snapshot.store.js';

const mysql = await createTestDatabase('ctx-snapshots');
const redis = await createTestRedis(8);

const repo = new MysqlRequirementSnapshotRepository({ db: mysql.db });
const store = new RequirementSnapshotStore(repo, { client: redis.client } as never);

const T0 = '2026-01-01T00:00:00.000Z';

async function newConversation(): Promise<string> {
  const id = ulid();
  await mysql.db.insert(conversations).values({ id, ownerKind: 'guest', ownerId: ulid() });
  return id;
}

beforeEach(async () => {
  await mysql.clear();
  await redis.clear();
});

afterAll(async () => {
  await mysql.close();
  await redis.close();
});

describe('RequirementSnapshot append-only', () => {
  it('version naik monoton mulai dari 1', async () => {
    const conv = await newConversation();
    const first = await store.append(conv, emptyRequirementState(T0), 'extraction');
    const second = await store.append(conv, emptyRequirementState(T0), 'user_edit');
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it('state menyimpan version yang sama dengan baris', async () => {
    const conv = await newConversation();
    const row = await store.append(conv, emptyRequirementState(T0), 'extraction');
    expect(row.state.version).toBe(row.version);
  });

  it('version unik per percakapan — duplikat ditolak basis data', async () => {
    const conv = await newConversation();
    await repo.append({
      id: ulid(),
      conversationId: conv,
      version: 1,
      state: emptyRequirementState(T0),
      trigger: 'extraction',
    });
    await expect(
      repo.append({
        id: ulid(),
        conversationId: conv,
        version: 1,
        state: emptyRequirementState(T0),
        trigger: 'extraction',
      }),
    ).rejects.toThrow();
  });

  it('findLatest mengembalikan snapshot ter-versi tertinggi', async () => {
    const conv = await newConversation();
    await store.append(conv, emptyRequirementState(T0), 'extraction');
    const merged = mergeRequirement(
      emptyRequirementState(T0),
      [{ path: 'building.floors', value: 3, source: 'user_stated' }],
      T0,
    ).state;
    await store.append(conv, merged, 'user_edit');

    const latest = await repo.findLatest(conv);
    expect(latest?.version).toBe(2);
    expect(latest?.state.building.floors.value).toBe(3);
  });

  it('snapshot dua percakapan tidak saling mengganggu version-nya', async () => {
    const a = await newConversation();
    const b = await newConversation();
    await store.append(a, emptyRequirementState(T0), 'extraction');
    await store.append(a, emptyRequirementState(T0), 'user_edit');
    const bFirst = await store.append(b, emptyRequirementState(T0), 'extraction');
    expect(bFirst.version).toBe(1);
  });
});

describe('write-through cache', () => {
  it('current membaca dari Redis setelah append (tanpa menyentuh MySQL)', async () => {
    const conv = await newConversation();
    await store.append(conv, emptyRequirementState(T0), 'extraction');

    // Hapus baris MySQL; bila current masih mengembalikan snapshot, ia dari cache.
    await mysql.db.delete(conversations); // cascade menghapus snapshot
    const current = await store.current(conv);
    expect(current?.version).toBe(1);
  });

  it('cache miss dilayani dari MySQL dan mengisi ulang cache', async () => {
    const conv = await newConversation();
    await store.append(conv, emptyRequirementState(T0), 'extraction');

    await redis.clear(); // Redis dikosongkan — simulasi flush
    const current = await store.current(conv);
    expect(current?.version).toBe(1); // dilayani MySQL

    // Setelah miss, cache terisi ulang: baris MySQL dihapus, current tetap ada.
    await mysql.db.delete(conversations);
    const afterRefill = await store.current(conv);
    expect(afterRefill?.version).toBe(1);
  });
});
