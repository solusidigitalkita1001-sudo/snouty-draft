/**
 * Port antrean handoff teknis. docs/BACKOFFICE.md · layar 11.
 *
 * Kebutuhan yang sudah terkumpul **disalin** ke dalam baris handoff, tidak dirujuk.
 * Tim teknis harus melihat apa yang dilihat pengguna saat kasusnya diserahkan — bukan
 * keadaan percakapan yang mungkin sudah berubah berkali-kali sejak itu.
 */

import type { KeyValue } from '@snouty/shared-types';

export const HANDOFF_REPOSITORY = Symbol('HANDOFF_REPOSITORY');

/** Urutan hidup sebuah kasus; dipakai juga sebagai enum validasi rute internal. */
export const HANDOFF_STATUSES = ['QUEUED', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export interface HandoffRow {
  readonly id: string;
  readonly conversationId: string;
  readonly reason: string;
  readonly captured: readonly KeyValue[];
  readonly status: HandoffStatus;
  readonly assignedTo: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

export interface EnqueueHandoffInput {
  readonly id: string;
  readonly conversationId: string;
  readonly reason: string;
  readonly captured: readonly KeyValue[];
}

/** Status yang masih menuntut pekerjaan dari tim teknis. */
export const OPEN_HANDOFF_STATUSES: readonly HandoffStatus[] = ['QUEUED', 'IN_REVIEW'];

/**
 * Baris antrean beserta orang yang menyerahkannya.
 *
 * Tim teknis menjawab kasus, dan jawaban butuh alamat. Pengguna yang menekan "Kirim ke tim
 * teknis Pralon" memang meminta dihubungi soal kasus itu — jadi kontaknya ikut, dan hanya
 * di layar ini. Tamu tidak punya kontak sama sekali; `submitter` null, dan layarnya
 * mengatakan apa adanya alih-alih memberi kesan ada yang bisa dihubungi.
 */
export interface HandoffQueueRow extends HandoffRow {
  readonly submitter: {
    readonly name: string;
    readonly email: string;
    readonly phone: string | null;
  } | null;
}

export interface HandoffRepository {
  enqueue(input: EnqueueHandoffInput): Promise<HandoffRow>;
  findById(id: string): Promise<HandoffRow | null>;
  /** Antrean kerja tim teknis: terlama dulu, karena itu urutan yang adil. */
  listQueued(limit?: number): Promise<readonly HandoffRow[]>;
  /**
   * Yang belum selesai — termasuk yang sudah diambil seseorang. `listQueued` saja membuat
   * kasus menghilang dari layar begitu ditangani, dan kasus yang hilang terasa seperti
   * kasus yang terlupakan.
   */
  listOpen(limit?: number): Promise<readonly HandoffQueueRow[]>;
  /** Yang sudah ditutup, terbaru dulu: bukti bahwa antreannya memang bergerak. */
  listClosed(limit?: number): Promise<readonly HandoffQueueRow[]>;
  findForConversation(conversationId: string): Promise<readonly HandoffRow[]>;
  /**
   * Memindahkan status. `resolvedAt` diisi saat kasus ditutup dan dikosongkan lagi bila
   * kasusnya dibuka kembali — stempel waktu penutupan yang tidak cocok dengan statusnya
   * adalah data yang berbohong.
   */
  setStatus(id: string, status: HandoffStatus, assignedTo: string | null): Promise<HandoffRow>;
}
