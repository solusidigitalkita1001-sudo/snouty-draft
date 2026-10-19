/** P24-03 — tautan bagikan: hanya pemilik, token tidak disimpan, cabut/ganti, hapus = hilang. */
import { describe, expect, it } from 'vitest';
import type { Recommendation } from '@snouty/shared-types';
import { ShareService, shareTokenHash } from './share.service.js';
import type { ShareLinkRepository, ShareLinkRow } from '../domain/share-link.repository.js';
import type { RequestActor } from '../../../shared/http/actor.js';

const owner: RequestActor = { kind: 'user', id: 'A'.repeat(26), tier: 'registered', roles: [] };
const other: RequestActor = { kind: 'user', id: 'B'.repeat(26), tier: 'registered', roles: [] };
type StoredLink = { -readonly [K in keyof ShareLinkRow]: ShareLinkRow[K] } & { tokenHash: string };
const REC = 'R'.repeat(26);
const CONV = 'C'.repeat(26);

function setup() {
  const stored: StoredLink[] = [];
  let deleted = false;
  const links: ShareLinkRepository = {
    async replace(row) {
      for (const r of stored)
        if (r.recommendationId === row.recommendationId) r.revokedAt ??= new Date();
      stored.push({ ...row, createdAt: new Date('2026-10-19T00:00:00Z'), revokedAt: null });
    },
    async findActiveByHash(hash) {
      return stored.find((r) => r.tokenHash === hash && r.revokedAt === null) ?? null;
    },
    async activeFor(id) {
      return stored.find((r) => r.recommendationId === id && r.revokedAt === null) ?? null;
    },
    async revokeFor(id) {
      for (const r of stored) if (r.recommendationId === id) r.revokedAt ??= new Date();
    },
  };
  const recommendation = {
    id: REC,
    conversationId: CONV,
    catalogVersionId: 'V'.repeat(26),
    createdAt: '2026-10-19T00:00:00Z',
    headline: 'Sistem distribusi untuk 4 titik air',
  } as unknown as Recommendation;
  const recommendations = {
    findById: async (id: string) => (id === REC ? recommendation : null),
  };
  const conversation = { id: CONV, title: 'Rumah Bekasi', language: 'id', deletedAt: null };
  const conversations = {
    find: async (id: string, actor: RequestActor) => {
      if (id !== CONV || actor.id !== owner.id || deleted)
        throw Object.assign(new Error(), { code: 'NOT_FOUND' });
      return conversation;
    },
    findForShare: async (id: string) => (id === CONV && !deleted ? conversation : null),
  };
  const snapshots = { current: async () => ({ state: {} }) };
  const analysis = { schematicForRecommendation: async () => ({ kind: 'flow' }) };
  const service = new ShareService(
    links,
    recommendations as never,
    conversations as never,
    snapshots as never,
    analysis as never,
  );
  return { service, stored, deleteConversation: () => (deleted = true) };
}

describe('ShareService', () => {
  it('pemilik membuat tautan; token 43 karakter base64url; yang tersimpan hanya hash-nya', async () => {
    const { service, stored } = setup();
    const { token } = await service.create(REC, owner);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored[0]!.tokenHash).toBe(shareTokenHash(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    const shared = await service.resolve(token);
    expect(shared).toMatchObject({ title: 'Rumah Bekasi', schematic: { kind: 'flow' } });
    expect(shared.recommendation.id).toBe(REC);
  });

  it('bukan pemilik tidak bisa membuat, melihat status, atau mencabut', async () => {
    const { service } = setup();
    await expect(service.create(REC, other)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.status(REC, other)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.revoke(REC, other)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('membuat ulang mencabut tautan lama; cabut mematikan semuanya; token rusak/acak NOT_FOUND', async () => {
    const { service } = setup();
    const first = await service.create(REC, owner);
    const second = await service.create(REC, owner);
    await expect(service.resolve(first.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.resolve(second.token)).resolves.toBeDefined();
    expect(await service.status(REC, owner)).toMatchObject({ active: true });
    await service.revoke(REC, owner);
    await expect(service.resolve(second.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await service.status(REC, owner)).toMatchObject({ active: false, createdAt: null });
    await expect(service.resolve('x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.resolve('A'.repeat(43))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('percakapan dihapus → tautannya tidak lagi membuka apa pun', async () => {
    const { service, deleteConversation } = setup();
    const { token } = await service.create(REC, owner);
    deleteConversation();
    await expect(service.resolve(token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
