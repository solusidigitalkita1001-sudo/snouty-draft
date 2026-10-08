/**
 * P10-06: penyerahan kasus menerbitkan job kirim ke tim teknis; antrean yang mati tidak
 * menggagalkan penyerahan (barisnya tetap di antrean tim teknis, OQ-08).
 */
import { describe, expect, it, vi } from 'vitest';
import { QUEUES } from '@snouty/jobs';
import { HandoffNotFoundError, HandoffService } from './handoff.service.js';
import type { HandoffRepository, HandoffRow } from '../domain/handoff.repository.js';

const CONV = '01JBC0NV0000000000000000AB';

function repo(): HandoffRepository {
  const rows = new Map<string, HandoffRow>();
  return {
    enqueue: (input) => {
      const row: HandoffRow = {
        ...input,
        status: 'QUEUED',
        assignedTo: null,
        createdAt: new Date('2026-10-08T10:00:00Z'),
        resolvedAt: null,
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
    findById: (id) => Promise.resolve(rows.get(id) ?? null),
    listQueued: () => Promise.resolve([...rows.values()]),
    findForConversation: () => Promise.resolve([]),
  };
}

const conversations = { find: vi.fn(() => Promise.resolve({})) } as never;
const snapshots = { current: vi.fn(() => Promise.resolve(null)) } as never;

describe('HandoffService (P10-06)', () => {
  it('menerbitkan job handoff.deliver berisi id saja', async () => {
    const publish = vi.fn(() => Promise.resolve(true));
    const service = new HandoffService(repo(), conversations, snapshots, null, { publish });
    const row = await service.enqueue(CONV, { kind: 'guest', id: 'g' } as never, 'Air panas');
    expect(publish).toHaveBeenCalledWith(QUEUES.handoffDeliver, {
      handoffId: row.id,
      correlationId: row.id,
    });
  });

  it('antrean mati: penyerahan tetap berhasil, dicatat sebagai peringatan', async () => {
    const warn = vi.fn();
    const service = new HandoffService(
      repo(),
      conversations,
      snapshots,
      null,
      { publish: () => Promise.resolve(false) },
      { warn },
    );
    const row = await service.enqueue(CONV, { kind: 'guest', id: 'g' } as never, 'Air panas');
    expect(row.status).toBe('QUEUED');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('messageFor: isi email dari baris; id tak dikenal → NOT_FOUND (tidak diulang worker)', async () => {
    const r = repo();
    const service = new HandoffService(r, conversations, snapshots);
    const row = await service.enqueue(CONV, { kind: 'guest', id: 'g' } as never, 'Air panas');
    expect((await service.messageFor(row.id)).subject).toContain('Air panas');
    await expect(service.messageFor('01JBXXXXXXXXXXXXXXXXXXXXXX')).rejects.toBeInstanceOf(
      HandoffNotFoundError,
    );
  });
});
