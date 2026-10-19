/** P24-01/02 — sematan dan proyek: kepemilikan, entitlement di lapis service, konteks catatan. */
import { describe, expect, it } from 'vitest';
import type {
  ConversationListQuery,
  ConversationOwner,
  ConversationRepository,
  ConversationRow,
} from '../domain/conversation.repository.js';
import type { ProjectRepository, ProjectRow } from '../domain/project.repository.js';
import { ConversationService } from './conversation.service.js';
import { ProjectService } from './project.service.js';

const alice: ConversationOwner = { kind: 'user', id: 'A'.repeat(26) };
const bob: ConversationOwner = { kind: 'user', id: 'B'.repeat(26) };
const guest: ConversationOwner = { kind: 'guest', id: 'G'.repeat(26) };

function fakes() {
  const rows = new Map<string, ConversationRow>();
  const projectRows = new Map<string, ProjectRow>();
  let clock = 1_000;
  const tick = () => new Date((clock += 1000));
  const conversations: ConversationRepository = {
    async create(row) {
      rows.set(row.id, {
        id: row.id,
        owner: row.owner,
        title: null,
        status: 'IN_PROGRESS',
        stage: 'KEBUTUHAN',
        language: row.language,
        projectId: row.projectId ?? null,
        pinnedAt: null,
        createdAt: tick(),
        updatedAt: tick(),
        deletedAt: null,
      });
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async list(query: ConversationListQuery) {
      return [...rows.values()]
        .filter((r) => r.owner.kind === query.owner.kind && r.owner.id === query.owner.id)
        .filter((r) => r.deletedAt === null)
        .filter((r) => (query.projectId === undefined ? true : r.projectId === query.projectId))
        .filter((r) => (query.pinned ? r.pinnedAt !== null : true))
        .sort((a, b) =>
          query.pinned
            ? b.pinnedAt!.getTime() - a.pinnedAt!.getTime()
            : b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
    },
    async updateTitle(id, title) {
      rows.set(id, { ...rows.get(id)!, title });
    },
    async updateStatus() {},
    async setPinned(id, pinned) {
      rows.set(id, { ...rows.get(id)!, pinnedAt: pinned ? tick() : null });
    },
    async setLanguage(id, language) {
      rows.set(id, { ...rows.get(id)!, language });
    },
    async setProject(id, projectId) {
      rows.set(id, { ...rows.get(id)!, projectId });
    },
    async softDelete(id) {
      rows.set(id, { ...rows.get(id)!, deletedAt: tick() });
    },
    async restore(id) {
      rows.set(id, { ...rows.get(id)!, deletedAt: null });
    },
    async appendMessage() {},
    async listMessages() {
      return [];
    },
  };
  const projects: ProjectRepository = {
    async create(row) {
      projectRows.set(row.id, {
        ...row,
        createdAt: tick(),
        updatedAt: tick(),
        deletedAt: null,
      });
    },
    async findById(id) {
      return projectRows.get(id) ?? null;
    },
    async list(ownerId) {
      return [...projectRows.values()]
        .filter((p) => p.ownerId === ownerId && p.deletedAt === null)
        .map((p) => ({
          ...p,
          conversationCount: [...rows.values()].filter(
            (r) => r.projectId === p.id && r.deletedAt === null,
          ).length,
        }));
    },
    async update(id, patch) {
      projectRows.set(id, { ...projectRows.get(id)!, ...patch });
    },
    async softDelete(id) {
      projectRows.set(id, { ...projectRows.get(id)!, deletedAt: tick() });
      for (const r of rows.values()) {
        if (r.projectId === id) rows.set(r.id, { ...r, projectId: null });
      }
    },
    async touch(id) {
      projectRows.set(id, { ...projectRows.get(id)!, updatedAt: tick() });
    },
  };
  return {
    rows,
    conversationService: new ConversationService(conversations, projects),
    projectService: new ProjectService(projects, conversations),
  };
}

describe('sematan (P24-01)', () => {
  it('pemilik menyematkan dan melepas; daftar sematan urut waktu disematkan; milik orang lain NOT_FOUND', async () => {
    const { conversationService } = fakes();
    const first = await conversationService.create(alice);
    const second = await conversationService.create(alice);
    await conversationService.pin(first.id, alice, true);
    await conversationService.pin(second.id, alice, true);
    const pinned = await conversationService.list(alice, { pinned: true });
    expect(pinned.map((r) => r.id)).toEqual([second.id, first.id]);
    await conversationService.pin(second.id, alice, false);
    expect((await conversationService.list(alice, { pinned: true })).map((r) => r.id)).toEqual([
      first.id,
    ]);
    await expect(conversationService.pin(first.id, bob, false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('proyek (P24-02)', () => {
  it('buat, ganti nama dan catatan, daftar dengan jumlah konsultasi; nama kosong ditolak', async () => {
    const { projectService, conversationService } = fakes();
    const project = await projectService.create(alice.id, '  Rumah   Bekasi ', 'PDAM, pakai PVC');
    expect(project.name).toBe('Rumah Bekasi');
    await conversationService.create(alice, 'id', project.id);
    const [listed] = await projectService.list(alice.id);
    expect(listed).toMatchObject({ id: project.id, conversationCount: 1 });
    const updated = await projectService.update(project.id, alice.id, { notes: '   ' });
    expect(updated.notes).toBeNull();
    await expect(projectService.create(alice.id, '   ', null)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('konsultasi hanya bisa masuk proyek milik sendiri; tamu tidak punya proyek', async () => {
    const { projectService, conversationService } = fakes();
    const project = await projectService.create(alice.id, 'SPAM Desa', null);
    await expect(conversationService.create(bob, 'id', project.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(conversationService.create(guest, 'id', project.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const own = await conversationService.create(alice);
    await conversationService.moveToProject(own.id, alice, project.id);
    expect(
      (await projectService.find(project.id, alice.id)).conversations.map((c) => c.id),
    ).toEqual([own.id]);
    await conversationService.moveToProject(own.id, alice, null);
    expect((await projectService.find(project.id, alice.id)).conversations).toEqual([]);
    await expect(projectService.find(project.id, bob.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('hapus proyek: konsultasinya tetap ada di riwayat, dilepas dari proyek', async () => {
    const { projectService, conversationService, rows } = fakes();
    const project = await projectService.create(alice.id, 'Kos', null);
    const inside = await conversationService.create(alice, 'id', project.id);
    await projectService.remove(project.id, alice.id);
    expect(rows.get(inside.id)).toMatchObject({ projectId: null, deletedAt: null });
    expect(await projectService.list(alice.id)).toEqual([]);
  });

  it('catatan proyek menjadi konteks; proyek dihapus atau catatan kosong → tanpa konteks', async () => {
    const { projectService, conversationService } = fakes();
    const project = await projectService.create(alice.id, 'Rumah Bekasi', 'sumber air PDAM');
    const inside = await conversationService.create(alice, 'id', project.id);
    expect(await conversationService.projectContext(inside.id)).toEqual({
      name: 'Rumah Bekasi',
      notes: 'sumber air PDAM',
    });
    const outside = await conversationService.create(alice);
    expect(await conversationService.projectContext(outside.id)).toBeNull();
    await projectService.update(project.id, alice.id, { notes: null });
    expect(await conversationService.projectContext(inside.id)).toBeNull();
  });
});

describe('bahasa percakapan (P25-01)', () => {
  it('pemilik mengganti bahasa balasan; percakapan orang lain NOT_FOUND', async () => {
    const { conversationService } = fakes();
    const row = await conversationService.create(alice, 'id');
    await conversationService.adoptLanguage(row.id, alice, 'en');
    expect((await conversationService.find(row.id, alice)).language).toBe('en');
    await expect(conversationService.adoptLanguage(row.id, bob, 'id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
