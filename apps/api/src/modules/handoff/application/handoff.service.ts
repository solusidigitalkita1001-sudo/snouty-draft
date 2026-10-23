/**
 * HandoffService — menyerahkan kasus ke tim teknis Pralon (layar 11).
 *
 * Dipanggil saat pengguna menekan "Kirim ke tim teknis Pralon" pada kartu validasi
 * teknis. Kebutuhan yang sudah terkumpul disalin ke dalam barisnya, sehingga janji
 * "tidak perlu menjelaskan ulang" benar-benar ditepati.
 */

import { Inject, Injectable } from '@nestjs/common';
import { QUEUES } from '@snouty/jobs';
import type { JobPublisher } from '../../../shared/queue/job-publisher.js';
import { handoffMessage, type HandoffMessage } from '../domain/handoff-message.js';
import { ulid } from '../../../shared/ulid.js';
import { ConversationService } from '../../conversation/application/conversation.service.js';
import type { ConversationOwner } from '../../conversation/domain/conversation.repository.js';
import { RequirementSnapshotStore } from '../../context/application/requirement-snapshot.store.js';
import type { UploadsService } from '../../uploads/application/uploads.service.js';
import { humanSize } from '../../uploads/domain/upload-policy.js';
import { assumptionCardFor, capturedFrom } from '../../context/application/message-pipeline.js';
import {
  HANDOFF_REPOSITORY,
  type HandoffQueueRow,
  type HandoffRepository,
  type HandoffRow,
  type HandoffStatus,
} from '../domain/handoff.repository.js';
import { slaDueAt } from '../domain/handoff-sla.js';
import { TECHNICAL_SLA_HOURS } from '../../policy/policy-cards.js';

/** Berapa kasus tertutup yang ikut ditampilkan — cukup untuk melihat antrean bergerak. */
const CLOSED_SHOWN = 10;

/** Satu baris antrean sebagaimana dilihat tim teknis. */
export interface HandoffBoardItem extends HandoffQueueRow {
  /** Kapan janji "1×24 jam kerja" jatuh tempo untuk kasus ini. */
  readonly dueAt: Date;
  readonly overdue: boolean;
}

export interface HandoffBoard {
  readonly open: readonly HandoffBoardItem[];
  readonly closed: readonly HandoffBoardItem[];
  readonly slaHours: number;
}

function withDeadline(row: HandoffQueueRow, now: Date): HandoffBoardItem {
  const dueAt = slaDueAt(row.createdAt, TECHNICAL_SLA_HOURS);
  // Kasus yang sudah ditutup tidak pernah "terlambat sekarang": yang diukur waktu
  // penutupannya, bukan jam dinding hari ini.
  const measuredAt = row.resolvedAt ?? now;
  return { ...row, dueAt, overdue: measuredAt.getTime() > dueAt.getTime() };
}

export class HandoffNotFoundError extends Error {
  // Tanpa kode ini filter memetakannya ke 503 `retryable` — worker mengulang job untuk
  // handoff yang memang tidak ada sampai masuk DLQ.
  readonly code = 'NOT_FOUND' as const;

  constructor() {
    super('Handoff tidak ditemukan.');
    this.name = 'HandoffNotFoundError';
  }
}

@Injectable()
export class HandoffService {
  constructor(
    @Inject(HANDOFF_REPOSITORY) private readonly handoffs: HandoffRepository,
    private readonly conversations: ConversationService,
    private readonly snapshots: RequirementSnapshotStore,
    /** Lampiran denah (P13-06); opsional supaya tes lama tidak berubah. */
    private readonly uploads: Pick<UploadsService, 'listForConversation'> | null = null,
    /** Pengiriman ke tim teknis lewat worker + n8n (P10-06, OQ-08); tanpa ini hanya antrean. */
    private readonly publisher: Pick<JobPublisher, 'publish'> | null = null,
    private readonly log: { warn(obj: object, msg: string): void } | null = null,
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

    const row = await this.handoffs.enqueue({
      id: ulid(),
      conversationId,
      reason,
      captured: [...captured, ...assumptions, ...attachments],
    });

    // Antrean gagal TIDAK menggagalkan penyerahan: barisnya sudah tersimpan di antrean tim
    // teknis (OQ-08: email + baris antrean), dan pengguna tidak boleh melihat kegagalan
    // integrasi sebagai "kasus Anda tidak terkirim".
    if (this.publisher) {
      const queued = await this.publisher.publish(QUEUES.handoffDeliver, {
        handoffId: row.id,
        correlationId: row.id,
      });
      if (!queued)
        this.log?.warn({ handoffId: row.id }, 'handoff tersimpan tetapi job kirim tidak terkirim');
    }
    return row;
  }

  /** Isi email untuk worker (rute internal). */
  async messageFor(handoffId: string): Promise<HandoffMessage> {
    const row = await this.handoffs.findById(handoffId);
    if (!row) throw new HandoffNotFoundError();
    return handoffMessage(row);
  }

  /** Antrean kerja tim teknis — dipakai back-office (layar menyusul, OQ-21). */
  async queue(limit?: number): Promise<readonly HandoffRow[]> {
    return this.handoffs.listQueued(limit);
  }

  /**
   * Isi layar antrean teknis (P29-01): yang belum selesai lebih dulu, lalu yang sudah
   * ditutup. Tenggatnya dihitung di sini — janji "1×24 jam kerja" adalah aturan bisnis, dan
   * layar tidak menghitung aturan bisnis sendiri.
   */
  async board(now: Date = new Date()): Promise<HandoffBoard> {
    const [open, closed] = await Promise.all([
      this.handoffs.listOpen(),
      this.handoffs.listClosed(CLOSED_SHOWN),
    ]);
    return {
      open: open.map((row) => withDeadline(row, now)),
      closed: closed.map((row) => withDeadline(row, now)),
      slaHours: TECHNICAL_SLA_HOURS,
    };
  }

  /**
   * Memindahkan status kasus. `IN_REVIEW` mencatat siapa yang mengambilnya; menutup kasus
   * melepas penugasan supaya daftar tidak menyimpan nama yang tidak lagi berarti apa-apa.
   */
  async changeStatus(id: string, status: HandoffStatus, actorId: string): Promise<HandoffRow> {
    const row = await this.handoffs.findById(id);
    if (!row) throw new HandoffNotFoundError();
    return this.handoffs.setStatus(id, status, status === 'IN_REVIEW' ? actorId : null);
  }
}
