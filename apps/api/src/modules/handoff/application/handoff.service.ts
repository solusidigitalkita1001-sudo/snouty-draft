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
import { assumptionCardFor } from '../../context/application/message-pipeline.js';
import { fieldEntries } from '../../context/domain/requirement-field.js';
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
    const captured = snapshot
      ? fieldEntries(snapshot.state)
          .filter(([, field]) => field.value !== null)
          .map(([path, field]) => ({ label: path, value: String(field.value) }))
      : [];

    // Asumsi ikut disertakan: tim teknis perlu tahu mana angka yang ditebak sistem.
    const assumptions = snapshot
      ? assumptionCardFor(snapshot.state).map((item) => ({
          label: `asumsi:${item.path}`,
          value: item.reason,
        }))
      : [];

    return this.handoffs.enqueue({
      id: ulid(),
      conversationId,
      reason,
      captured: [...captured, ...assumptions],
    });
  }

  /** Antrean kerja tim teknis — dipakai back-office (layar menyusul, OQ-21). */
  async queue(limit?: number): Promise<readonly HandoffRow[]> {
    return this.handoffs.listQueued(limit);
  }
}
