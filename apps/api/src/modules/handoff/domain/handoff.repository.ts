/**
 * Port antrean handoff teknis. docs/BACKOFFICE.md · layar 11.
 *
 * Kebutuhan yang sudah terkumpul **disalin** ke dalam baris handoff, tidak dirujuk.
 * Tim teknis harus melihat apa yang dilihat pengguna saat kasusnya diserahkan — bukan
 * keadaan percakapan yang mungkin sudah berubah berkali-kali sejak itu.
 */

import type { KeyValue } from '@snouty/shared-types';

export const HANDOFF_REPOSITORY = Symbol('HANDOFF_REPOSITORY');

export type HandoffStatus = 'QUEUED' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

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

export interface HandoffRepository {
  enqueue(input: EnqueueHandoffInput): Promise<HandoffRow>;
  findById(id: string): Promise<HandoffRow | null>;
  /** Antrean kerja tim teknis: terlama dulu, karena itu urutan yang adil. */
  listQueued(limit?: number): Promise<readonly HandoffRow[]>;
  findForConversation(conversationId: string): Promise<readonly HandoffRow[]>;
}
