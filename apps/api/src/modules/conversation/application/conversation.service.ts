/**
 * Use case percakapan — Fase 3: membuat, mendaftar, menamai, menghapus, dan
 * menambah pesan. Balasan asisten dan pipeline analisis datang di Fase 4.
 *
 * **Kepemilikan diperiksa DI SINI**, bukan hanya lewat klausa `WHERE` di
 * repository (docs/SECURITY.md §4). Setiap method yang menyentuh satu percakapan
 * memuatnya dulu lalu membandingkan pemiliknya dengan aktor — sehingga
 * menghilangkan satu filter di SQL tidak membocorkan apa pun.
 *
 * Percakapan milik orang lain menjawab `NOT_FOUND`, bukan `403`: "ada tapi bukan
 * milikmu" adalah informasi, dan id percakapan cukup acak untuk tidak layak
 * dikonfirmasi keberadaannya.
 */

import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type { AssistantCard, ConversationStatus } from '@snouty/shared-types';
import { ulid } from '../../../shared/ulid.js';
import {
  ConversationNotFoundError,
  EmptyMessageError,
  ProjectNotFoundError,
} from '../domain/conversation.errors.js';
import type { ProjectRepository } from '../domain/project.repository.js';
import type {
  ConversationListQuery,
  ConversationOwner,
  ConversationRepository,
  ConversationRow,
  MessageRow,
} from '../domain/conversation.repository.js';

export interface ListFilter {
  readonly status?: ConversationStatus;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly pinned?: boolean;
  readonly projectId?: string;
}

const MAX_TITLE_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 8_000;

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    /** Proyek (P24-02); tanpa ini konsultasi tidak bisa dimasukkan ke proyek. */
    private readonly projects: ProjectRepository | null = null,
  ) {}

  async create(
    owner: ConversationOwner,
    language: Locale = DEFAULT_LOCALE,
    projectId: string | null = null,
  ): Promise<ConversationRow> {
    if (projectId !== null) await this.ownedProject(projectId, owner);
    const id = ulid();
    await this.repository.create({ id, owner, language, projectId });
    if (projectId !== null) await this.projects?.touch(projectId);
    return this.owned(id, owner);
  }

  /**
   * Percakapan aktif TANPA pemeriksaan aktor — hanya untuk tautan bagikan (P24-03), yang
   * otorisasinya adalah token itu sendiri. Dihapus = tidak ada.
   */
  async findForShare(id: string): Promise<ConversationRow | null> {
    const row = await this.repository.findById(id);
    return row === null || row.deletedAt !== null ? null : row;
  }

  /** Sematkan atau lepas sematan (P24-01) — hanya pemiliknya. */
  async pin(id: string, actor: ConversationOwner, pinned: boolean): Promise<void> {
    await this.owned(id, actor);
    await this.repository.setPinned(id, pinned);
  }

  /**
   * Bahasa balasan mengikuti kalimat pengguna (P25-01): disimpan supaya kartu jawaban, judul, dan
   * laporan setelah giliran ini memakai bahasa yang sama dengan balasannya.
   */
  async adoptLanguage(id: string, actor: ConversationOwner, language: Locale): Promise<void> {
    await this.owned(id, actor);
    await this.repository.setLanguage(id, language);
  }

  /** Pindahkan ke proyek milik aktor, atau lepas dari proyek (`null`) (P24-02). */
  async moveToProject(
    id: string,
    actor: ConversationOwner,
    projectId: string | null,
  ): Promise<void> {
    await this.owned(id, actor);
    if (projectId !== null) {
      await this.ownedProject(projectId, actor);
      await this.projects?.touch(projectId);
    }
    await this.repository.setProject(id, projectId);
  }

  /**
   * Catatan proyek sebuah konsultasi (P24-02): dibaca pipeline pesan sebagai konteks giliran
   * pertama. `null` bila tanpa proyek, proyeknya dihapus, atau catatannya kosong.
   */
  async projectContext(id: string): Promise<{ name: string; notes: string } | null> {
    const row = await this.repository.findById(id);
    if (row === null || row.projectId === null || this.projects === null) return null;
    const project = await this.projects.findById(row.projectId);
    if (project === null || project.deletedAt !== null || project.notes === null) return null;
    return { name: project.name, notes: project.notes };
  }

  async find(id: string, actor: ConversationOwner): Promise<ConversationRow> {
    return this.owned(id, actor);
  }

  async list(actor: ConversationOwner, filter: ListFilter): Promise<readonly ConversationRow[]> {
    const query: ConversationListQuery = { owner: actor, ...filter };
    return this.repository.list(query);
  }

  async rename(id: string, actor: ConversationOwner, title: string): Promise<void> {
    await this.owned(id, actor);
    const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
    if (trimmed === '') throw new EmptyMessageError('title');
    await this.repository.updateTitle(id, trimmed);
  }

  /**
   * Menyimpan hasil konsultasi (layar 06 → riwayat). Entitlement `SAVE_SOLUTION`
   * ditegakkan di controller (lapis dua); di sini yang diperiksa kepemilikannya.
   */
  async save(id: string, actor: ConversationOwner): Promise<void> {
    await this.owned(id, actor);
    await this.repository.updateStatus(id, 'SAVED', 'SOLUSI');
  }

  /** Dipakai pipeline rekomendasi saat solusi siap (Fase 7). */
  async markSolutionReady(id: string): Promise<void> {
    await this.repository.updateStatus(id, 'SOLUTION_READY', 'SOLUSI');
  }

  async remove(id: string, actor: ConversationOwner): Promise<void> {
    await this.owned(id, actor);
    await this.repository.softDelete(id);
  }

  /**
   * "Urungkan" setelah menghapus dari riwayat. Hanya pemiliknya; baris yang tidak dihapus
   * dibiarkan (idempoten). Datanya memang tidak pernah hilang — itu arti soft delete.
   */
  async restore(id: string, actor: ConversationOwner): Promise<void> {
    const row = await this.repository.findById(id);
    if (row === null || row.owner.kind !== actor.kind || row.owner.id !== actor.id) {
      throw new ConversationNotFoundError(id);
    }
    if (row.deletedAt !== null) await this.repository.restore(id);
  }

  /**
   * Pesan pengguna. Balasan asisten TIDAK lahir di sini — ia milik pipeline Fase 4;
   * method terpisah di bawah dipakai pipeline itu nanti.
   */
  async appendUserMessage(
    id: string,
    actor: ConversationOwner,
    textContent: string,
  ): Promise<MessageRow> {
    await this.owned(id, actor);
    const trimmed = textContent.trim();
    if (trimmed === '') throw new EmptyMessageError('text');

    const messageId = ulid();
    await this.repository.appendMessage({
      id: messageId,
      conversationId: id,
      role: 'user',
      text: trimmed.slice(0, MAX_MESSAGE_LENGTH),
    });
    return this.message(id, messageId);
  }

  /** Dipakai pipeline Fase 4 — aktor tidak diperiksa karena pemanggilnya sistem. */
  async appendAssistantMessage(
    id: string,
    textContent: string,
    cards: readonly AssistantCard[],
    mood: string | null,
  ): Promise<MessageRow> {
    const messageId = ulid();
    await this.repository.appendMessage({
      id: messageId,
      conversationId: id,
      role: 'assistant',
      text: textContent,
      cards,
      mood,
    });
    return this.message(id, messageId);
  }

  async messages(id: string, actor: ConversationOwner): Promise<readonly MessageRow[]> {
    await this.owned(id, actor);
    return this.repository.listMessages(id);
  }

  private async owned(id: string, actor: ConversationOwner): Promise<ConversationRow> {
    const row = await this.repository.findById(id);
    if (row === null || row.deletedAt !== null) throw new ConversationNotFoundError(id);
    if (row.owner.kind !== actor.kind || row.owner.id !== actor.id) {
      // NOT_FOUND, bukan 403 — lihat komentar kelas.
      throw new ConversationNotFoundError(id);
    }
    return row;
  }

  private async ownedProject(projectId: string, actor: ConversationOwner): Promise<void> {
    if (actor.kind !== 'user' || this.projects === null) throw new ProjectNotFoundError(projectId);
    const project = await this.projects.findById(projectId);
    if (project === null || project.deletedAt !== null || project.ownerId !== actor.id) {
      throw new ProjectNotFoundError(projectId);
    }
  }

  private async message(conversationId: string, messageId: string): Promise<MessageRow> {
    const rows = await this.repository.listMessages(conversationId);
    const found = rows.find((row) => row.id === messageId);
    if (found === undefined) throw new ConversationNotFoundError(conversationId);
    return found;
  }
}
