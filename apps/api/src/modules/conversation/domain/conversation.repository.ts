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
  Locale,
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
  /** Bahasa percakapan (0019): jawaban model dan teks UI mengikutinya. */
  readonly language: Locale;
  /** Proyek pengelompok (P24-02); `null` = tanpa proyek. */
  readonly projectId: string | null;
  /** Waktu disematkan (P24-01); `null` = tidak disematkan. */
  readonly pinnedAt: Date | null;
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
  /** `true` = hanya yang disematkan, urut waktu disematkan terbaru dulu (P24-01). */
  readonly pinned?: boolean;
  /** Hanya konsultasi di proyek ini (P24-02). */
  readonly projectId?: string;
}

export interface ConversationRepository {
  create(row: {
    id: string;
    owner: ConversationOwner;
    language: Locale;
    projectId?: string | null;
  }): Promise<void>;

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

  /** Sematkan / lepas sematan — tidak mengubah urutan "terbaru diperbarui" (P24-01). */
  setPinned(id: string, pinned: boolean): Promise<void>;
  /** Pindahkan ke proyek atau lepas dari proyek (`null`) — tidak mengubah urutan riwayat. */
  setProject(id: string, projectId: string | null): Promise<void>;
  /** Bahasa balasan terkini, dari kalimat pengguna (P25-01) — tidak mengubah urutan riwayat. */
  setLanguage(id: string, language: Locale): Promise<void>;

  softDelete(id: string): Promise<void>;
  /** Membatalkan soft delete ("Urungkan" di riwayat). */
  restore(id: string): Promise<void>;

  appendMessage(message: {
    id: string;
    conversationId: string;
    role: MessageRole;
    text: string;
    cards?: readonly AssistantCard[];
    mood?: string | null;
    /** Label pemahaman pesan pengguna (P26-02), bila sudah diketahui saat ditulis. */
    intent?: string | null;
  }): Promise<void>;

  /** Label pemahaman ditulis setelah giliran dipahami (P26-02) — tidak mengubah urutan riwayat. */
  setMessageIntent(messageId: string, intent: string): Promise<void>;

  listMessages(conversationId: string): Promise<readonly MessageRow[]>;
}
