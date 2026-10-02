/**
 * Port repository percakapan. docs/DOMAIN_MODEL.md §4.
 *
 * Setiap pembacaan di sini menerima `owner` dan memfilternya di query — tetapi itu
 * BUKAN pemeriksaan kepemilikannya. Pemeriksaan kepemilikan hidup di lapisan
 * application (docs/SECURITY.md §4): menghilangkan satu `WHERE owner_id = ?` di
 * repository tidak boleh cukup untuk membocorkan data orang.
 */

import type {
  AssistantCard,
  ConversationStage,
  ConversationStatus,
  MessageRole,
} from '@snouty/shared-types';

export const CONVERSATION_REPOSITORY = Symbol('CONVERSATION_REPOSITORY');

export interface ConversationOwner {
  readonly kind: 'user' | 'guest';
  readonly id: string;
}

export interface ConversationRow {
  readonly id: string;
  readonly owner: ConversationOwner;
  readonly title: string | null;
  readonly status: ConversationStatus;
  readonly stage: ConversationStage;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface MessageRow {
  readonly id: string;
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly text: string;
  readonly cards: readonly AssistantCard[];
  readonly mood: string | null;
  readonly createdAt: Date;
}

export interface ConversationListQuery {
  readonly owner: ConversationOwner;
  readonly status?: ConversationStatus;
  /** Pencarian bebas pada judul. */
  readonly q?: string;
  /** `updatedAt` ISO milik baris terakhir halaman sebelumnya. */
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ConversationRepository {
  create(row: { id: string; owner: ConversationOwner }): Promise<void>;

  /** Termasuk yang soft-deleted TIDAK ikut — penghapusan harus terlihat terhapus. */
  findById(id: string): Promise<ConversationRow | null>;

  list(query: ConversationListQuery): Promise<readonly ConversationRow[]>;

  updateTitle(id: string, title: string): Promise<void>;

  /**
   * Mengubah status dan tahap percakapan. Dipakai saat solusi tersusun (Fase 7) dan
   * saat pengguna menyimpannya (Fase 8). Keduanya bergerak bersama: status `SAVED`
   * tanpa tahap `SOLUSI` akan membuat header layar bertentangan dengan isinya.
   */
  updateStatus(id: string, status: ConversationStatus, stage?: ConversationStage): Promise<void>;

  softDelete(id: string): Promise<void>;

  appendMessage(message: {
    id: string;
    conversationId: string;
    role: MessageRole;
    text: string;
    cards?: readonly AssistantCard[];
    mood?: string | null;
  }): Promise<void>;

  listMessages(conversationId: string): Promise<readonly MessageRow[]>;
}
