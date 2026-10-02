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

import type { AssistantCard, ConversationStatus } from '@snouty/shared-types';
import { ulid } from '../../../shared/ulid.js';
import { ConversationNotFoundError, EmptyMessageError } from '../domain/conversation.errors.js';
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
}

const MAX_TITLE_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 8_000;

export class ConversationService {
  constructor(private readonly repository: ConversationRepository) {}

  async create(owner: ConversationOwner): Promise<ConversationRow> {
    const id = ulid();
    await this.repository.create({ id, owner });
    return this.owned(id, owner);
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

  async remove(id: string, actor: ConversationOwner): Promise<void> {
    await this.owned(id, actor);
    await this.repository.softDelete(id);
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

  private async message(conversationId: string, messageId: string): Promise<MessageRow> {
    const rows = await this.repository.listMessages(conversationId);
    const found = rows.find((row) => row.id === messageId);
    if (found === undefined) throw new ConversationNotFoundError(conversationId);
    return found;
  }
}
