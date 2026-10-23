/**
 * P10-06: penyerahan kasus menerbitkan job kirim ke tim teknis; antrean yang mati tidak
 * menggagalkan penyerahan (barisnya tetap di antrean tim teknis, OQ-08).
 */
import { describe, expect, it, vi } from 'vitest';
import { QUEUES } from '@snouty/jobs';
import { HandoffNotFoundError, HandoffService } from './handoff.service.js';
import {
  OPEN_HANDOFF_STATUSES,
  type HandoffQueueRow,
  type HandoffRepository,
  type HandoffRow,
} from '../domain/handoff.repository.js';

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
    listOpen: () =>
      Promise.resolve(
        [...rows.values()]
          .filter((row) => OPEN_HANDOFF_STATUSES.includes(row.status))
          .map(withSubmitter),
      ),
    listClosed: () =>
      Promise.resolve(
        [...rows.values()]
          .filter((row) => !OPEN_HANDOFF_STATUSES.includes(row.status))
          .map(withSubmitter),
      ),
    setStatus: (id, status, assignedTo) => {
      const row = rows.get(id);
      if (!row) throw new Error('tidak ada');
      const next: HandoffRow = {
        ...row,
        status,
        assignedTo,
        resolvedAt: OPEN_HANDOFF_STATUSES.includes(status)
          ? null
          : new Date('2026-10-09T10:00:00Z'),
      };
      rows.set(id, next);
      return Promise.resolve(next);
    },
    findForConversation: () => Promise.resolve([]),
  };
}

const withSubmitter = (row: HandoffRow): HandoffQueueRow => ({ ...row, submitter: null });

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

/**
 * P29-01a — isi layar antrean teknis: tenggat per kasus, dan "terlambat" yang diukur
 * terhadap waktu penutupan untuk kasus yang sudah selesai.
 */
describe('antrean teknis untuk back-office (P29-01)', () => {
  const guest = { kind: 'guest', id: 'g' } as never;

  it('kasus yang masih terbuka membawa tenggat 1×24 jam kerja', async () => {
    const service = new HandoffService(repo(), conversations, snapshots);
    await service.enqueue(CONV, guest, 'Air panas');

    // Masuk Kamis 8 Okt 2026 17:00 WIB → tenggatnya Jumat 17:00 WIB.
    const board = await service.board(new Date('2026-10-08T12:00:00Z'));
    expect(board.open).toHaveLength(1);
    expect(board.open[0]?.dueAt.toISOString()).toBe('2026-10-09T10:00:00.000Z');
    expect(board.open[0]?.overdue).toBe(false);
    expect(board.slaHours).toBe(24);
  });

  it('kasus yang lewat tenggat ditandai terlambat', async () => {
    const service = new HandoffService(repo(), conversations, snapshots);
    await service.enqueue(CONV, guest, 'Air panas');

    const board = await service.board(new Date('2026-10-12T10:00:00Z'));
    expect(board.open[0]?.overdue).toBe(true);
  });

  it('kasus yang sudah ditutup dinilai pada waktu penutupannya, bukan hari ini', async () => {
    const service = new HandoffService(repo(), conversations, snapshots);
    const row = await service.enqueue(CONV, guest, 'Air panas');
    await service.changeStatus(row.id, 'RESOLVED', 'aktor');

    // Jauh di kemudian hari: kasusnya tetap tidak terlambat, karena ditutup tepat waktu.
    const board = await service.board(new Date('2026-11-30T10:00:00Z'));
    expect(board.open).toHaveLength(0);
    expect(board.closed[0]?.overdue).toBe(false);
  });

  it('mengambil kasus mencatat siapa yang mengambilnya; menutupnya melepas lagi', async () => {
    const service = new HandoffService(repo(), conversations, snapshots);
    const row = await service.enqueue(CONV, guest, 'Air panas');

    expect((await service.changeStatus(row.id, 'IN_REVIEW', 'teknisi-1')).assignedTo).toBe(
      'teknisi-1',
    );
    expect((await service.changeStatus(row.id, 'CLOSED', 'teknisi-1')).assignedTo).toBeNull();
  });

  it('status kasus yang tidak ada ditolak, bukan diam-diam dibuat', async () => {
    const service = new HandoffService(repo(), conversations, snapshots);
    await expect(service.changeStatus('tidak-ada', 'RESOLVED', 'aktor')).rejects.toBeInstanceOf(
      HandoffNotFoundError,
    );
  });
});
