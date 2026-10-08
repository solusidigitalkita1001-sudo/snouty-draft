import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { UploadRepository, UploadRow } from '../domain/upload.repository.js';
import { LocalFileStore } from '../infrastructure/file-store.js';
import { UploadRejectedError, UploadsService, UploadNotFoundError } from './uploads.service.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const CONV = 'C'.repeat(26);
const GUEST = { kind: 'guest', id: 'G'.repeat(26), tier: 'guest', roles: [] } as const;
const NOW = new Date('2026-10-08T00:00:00Z');

function memoryRepo(): UploadRepository & { rows: Map<string, UploadRow> } {
  const rows = new Map<string, UploadRow>();
  return {
    rows,
    insert: async (row) => void rows.set(row.id, { ...row, createdAt: NOW }),
    findById: async (id) => rows.get(id) ?? null,
    listForConversation: async (c) => [...rows.values()].filter((r) => r.conversationId === c),
    listExpired: async (now, limit) =>
      [...rows.values()].filter((r) => r.expiresAt <= now).slice(0, limit),
    delete: async (id) => void rows.delete(id),
  };
}

function setup(opts: { allowed?: boolean; owned?: boolean; now?: () => Date } = {}) {
  const repo = memoryRepo();
  const dir = mkdtempSync(join(tmpdir(), 'uploads-'));
  const store = new LocalFileStore(dir);
  const conversations = {
    find: vi.fn(async () => {
      if (opts.owned === false)
        throw Object.assign(new Error('bukan milik'), { code: 'NOT_FOUND' });
      return { language: 'id' } as never;
    }),
    appendUserMessage: vi.fn(async () => ({}) as never),
    appendAssistantMessage: vi.fn(async () => ({}) as never),
  };
  const limiter = {
    consume: vi.fn(async () =>
      opts.allowed === false
        ? { allowed: false, remaining: 0, retryAfterSec: 3600 }
        : { allowed: true, remaining: 1, retryAfterSec: 0 },
    ),
  };
  const service = new UploadsService(
    repo,
    store,
    conversations,
    limiter,
    { maxBytes: 1024, retentionDays: 180 },
    opts.now ?? (() => NOW),
  );
  return { service, repo, store, conversations, limiter, dir };
}

describe('UploadsService.upload', () => {
  it('berkas sah: disimpan dengan nama ULID, metadata + 2 pesan tercatat, kuota tamu dihitung', async () => {
    const { service, repo, store, conversations, limiter } = setup();
    const result = await service.upload(CONV, GUEST, '../denah lantai 1.png', PNG);
    expect(result.upload.originalName).toBe('denah lantai 1.png');
    expect(result.upload.mimeType).toBe('image/png');
    expect(readFileSync(store.pathOf(result.upload.id))).toEqual(Buffer.from(PNG));
    expect(repo.rows.size).toBe(1);
    expect(result.upload.expiresAt.toISOString()).toBe('2027-04-06T00:00:00.000Z'); // +180 hari
    expect(result.userText).toBe('Denah terlampir: denah lantai 1.png (1 KB)');
    expect(result.replyText).toMatch(/^Denahnya sudah saya terima/);
    expect(conversations.appendUserMessage).toHaveBeenCalledWith(CONV, GUEST, result.userText);
    expect(limiter.consume).toHaveBeenCalledWith('uploads', `guest:${GUEST.id}`, {
      max: 2,
      windowSeconds: 86_400,
    });
  });

  it('tipe tidak sah ditolak SEBELUM kuota dan tanpa menyentuh disk', async () => {
    const { service, repo, limiter } = setup();
    await expect(
      service.upload(CONV, GUEST, 'x.png', Uint8Array.from(Buffer.from('<html>'))),
    ).rejects.toBeInstanceOf(UploadRejectedError);
    expect(limiter.consume).not.toHaveBeenCalled();
    expect(repo.rows.size).toBe(0);
  });

  it('kuota harian habis → RATE_LIMITED; percakapan orang lain → ditolak sebelum apa pun', async () => {
    await expect(
      setup({ allowed: false }).service.upload(CONV, GUEST, 'a.png', PNG),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    const other = setup({ owned: false });
    await expect(other.service.upload(CONV, GUEST, 'a.png', PNG)).rejects.toThrow('bukan milik');
    expect(other.repo.rows.size).toBe(0);
  });
});

describe('UploadsService — unduhan dan retensi', () => {
  it('pemilik mendapat jalurnya; lampiran kedaluwarsa tidak bisa diunduh lagi', async () => {
    let now = NOW;
    const { service } = setup({ now: () => now });
    const { upload } = await service.upload(CONV, GUEST, 'a.png', PNG);
    expect((await service.fileFor(upload.id, GUEST)).path).toContain(upload.id);
    now = new Date(NOW.getTime() + 181 * 86_400_000);
    await expect(service.fileFor(upload.id, GUEST)).rejects.toBeInstanceOf(UploadNotFoundError);
  });

  it('purgeExpired menghapus berkas dan barisnya setelah masa simpan', async () => {
    let now = NOW;
    const { service, repo, store } = setup({ now: () => now });
    const { upload } = await service.upload(CONV, GUEST, 'a.png', PNG);
    expect(await service.purgeExpired()).toBe(0);
    now = new Date(NOW.getTime() + 181 * 86_400_000);
    expect(await service.purgeExpired()).toBe(1);
    expect(repo.rows.size).toBe(0);
    expect(existsSync(store.pathOf(upload.id))).toBe(false);
  });
});

describe('LocalFileStore', () => {
  it('menolak id yang bukan ULID (tidak ada path traversal)', () => {
    const store = new LocalFileStore(mkdtempSync(join(tmpdir(), 'fs-')));
    expect(() => store.pathOf('../../etc/passwd')).toThrow();
    expect(() => store.pathOf('01M4DJWS3RDEDK4Y3V2QDHSPMG')).not.toThrow();
  });
});
