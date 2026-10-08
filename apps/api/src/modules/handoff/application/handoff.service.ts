/**
 * HandoffService — menyerahkan kasus ke tim teknis Pralon (layar 11).
 *
 * Dipanggil saat pengguna menekan "Kirim ke tim teknis Pralon" pada kartu validasi
 * teknis. Kebutuhan yang sudah terkumpul disalin ke dalam barisnya, sehingga janji
 * "tidak perlu menjelaskan ulang" benar-benar ditepati.
 */

import { Inject, Injectable } from '@nestjs/common';
import { ulid } from '../../../shared/ulid.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import type { UploadsService } from '../../uploads/application/uploads.service.js';
import { humanSize } from '../../uploads/domain/upload-policy.js';
import { assumptionCardFor, capturedFrom } from '../../context/application/message-pipeline.js';
import {
  HANDOFF_REPOSITORY,
  type HandoffRepository,
  type HandoffRow,
} from '../domain/handoff.repository.js';

@Injectable()
export class HandoffService {
  constructor(
    @Inject(HANDOFF_REPOSITORY) private readonly handoffs: HandoffRepository,
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    /** Lampiran denah (P13-06); opsional supaya tes lama tidak berubah. */
    private readonly uploads: Pick<UploadsService, 'listForConversation'> | null = null,
  ) {}

  async enqueue(
    conversationId: string,
    actor: ConversationOwner,
    reason: string,
  ): Promise<HandoffRow> {
    // Kepemilikan di lapisan application — tamu pun boleh menyerahkan kasusnya
    // sendiri, tetapi hanya kasusnya sendiri.
    await this.conversations.find(conversationId, actor);

    const snapshot = await this.snapshots.current(conversationId);
    // Bahasa pengguna (label + nilai terbaca), termasuk jawaban jalur irigasi — sama persis
    // dengan yang dilihat pengguna di kartu "yang sudah saya catat".
    const captured = snapshot ? capturedFrom(snapshot.state) : [];

    // Asumsi ikut disertakan: tim teknis perlu tahu mana angka yang ditebak sistem.
    const assumptions = snapshot
      ? assumptionCardFor(snapshot.state).map((item) => ({
          label: `asumsi:${item.path}`,
          value: item.reason,
        }))
      : [];

    // Denah yang dilampirkan ikut tercatat — tim teknis membukanya lewat id lampiran.
    const attachments = this.uploads
      ? (await this.uploads.listForConversation(conversationId)).map((upload) => ({
          label: `lampiran:${upload.id}`,
          value: `${upload.originalName} (${humanSize(upload.sizeBytes)})`,
        }))
      : [];

    return this.handoffs.enqueue({
      id: ulid(),
      conversationId,
      reason,
      captured: [...captured, ...assumptions, ...attachments],
    });
  }

  /** Antrean kerja tim teknis — dipakai back-office (layar menyusul, OQ-21). */
  async queue(limit?: number): Promise<readonly HandoffRow[]> {
    return this.handoffs.listQueued(limit);
  }
}
