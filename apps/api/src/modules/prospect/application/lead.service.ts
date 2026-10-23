import type { Logger } from 'pino';
import { ulid } from '../../../shared/ulid.js';
import {
  canSeeLead,
  DUE_FOLLOW_UP_BATCH,
  EmptyNoteError,
  MAX_NOTE_CHARS,
  LeadNotFoundError,
  LostReasonRequiredError,
  validStatusChange,
  type InternalViewer,
  type LeadActivity,
  type LeadContext,
  type LeadFacts,
  type LeadRecord,
  type LeadStore,
  type TranscriptLine,
} from '../domain/lead.js';
import type { LeadStatus, ProspectRow } from '../domain/prospect-board.js';
import type { Notifier } from '../../../shared/notification/notifier.port.js';
import type { LeadContextWriter } from './lead-context.writer.js';
import type { ProspectBoardService } from './prospect-board.service.js';

export interface LeadDetail {
  readonly lead: LeadRecord;
  readonly prospect: ProspectRow | null;
  readonly facts: LeadFacts;
}

/**
 * Dashboard sales (P26-06). Sales hanya melihat prospek yang ditugaskan kepadanya; prospek orang lain
 * dijawab NOT_FOUND, bukan 403 — keberadaannya pun bukan urusannya.
 */
export class LeadService {
  constructor(
    private readonly leads: LeadStore,
    private readonly board: ProspectBoardService,
    private readonly writer: LeadContextWriter,
    private readonly notifier: Notifier | null = null,
    private readonly log: Pick<Logger, 'warn' | 'info'> | null = null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Prospek milik sales ini, urut prioritas — dari penilaian yang sama dengan papan admin. */
  async mine(viewer: InternalViewer): Promise<readonly ProspectRow[]> {
    const { items } = await this.board.board({});
    return items.filter((row) => row.lead?.salesUserId === viewer.id);
  }

  async detail(userId: string, viewer: InternalViewer): Promise<LeadDetail> {
    const lead = await this.visible(userId, viewer);
    const [{ items }, facts] = await Promise.all([this.board.board({}), this.leads.facts(userId)]);
    return { lead, prospect: items.find((row) => row.user.id === userId) ?? null, facts };
  }

  async setStatus(
    userId: string,
    viewer: InternalViewer,
    status: LeadStatus,
    lostReason: string | null,
  ): Promise<void> {
    await this.visible(userId, viewer);
    if (!validStatusChange(status, lostReason)) throw new LostReasonRequiredError();
    const reason = status === 'lost' ? lostReason!.trim() : null;
    await this.leads.setStatus(userId, status, reason);
    // Perubahan status masuk jejak (P27-09): "sekarang kalah" tanpa kapan dan oleh siapa bukan
    // riwayat yang bisa dipakai siapa pun.
    await this.record(userId, viewer, { kind: 'status', status, note: reason });
  }

  /**
   * Catatan tindak lanjut dari sales (P27-09, pemilik 2026-10-23: "CRM mengenai prospek harus di
   * dalemin lebih lanjut"): apa yang terjadi saat dihubungi, dengan nama pencatat dan waktunya.
   */
  async addNote(userId: string, viewer: InternalViewer, note: string): Promise<void> {
    await this.visible(userId, viewer);
    const text = note.trim().slice(0, MAX_NOTE_CHARS);
    if (text.length === 0) throw new EmptyNoteError();
    await this.record(userId, viewer, { kind: 'note', note: text });
  }

  /** Kapan prospek ini ditengok lagi; `null` menghapus jadwalnya. */
  async setFollowUp(userId: string, viewer: InternalViewer, at: Date | null): Promise<void> {
    await this.visible(userId, viewer);
    await this.leads.setFollowUp(userId, at);
    await this.record(userId, viewer, { kind: 'follow_up', followUpAt: at });
  }

  /**
   * Sapuan pengingat tindak lanjut (P28-01). Tanggal tengok yang lewat tidak berguna kalau tidak
   * ada yang membangunkan sales-nya: sebelum ini tanggalnya hanya memerah bila layarnya kebetulan
   * dibuka.
   *
   * Prospeknya ditandai lebih dulu, baru diberitahu. Urutan sebaliknya berisiko mengirim
   * pengingat yang sama berulang kali bila penandaannya gagal — dan pengingat kembar lebih
   * merusak kepercayaan pada loncengnya daripada satu pengingat yang telat sekali sapuan.
   */
  async remindDueFollowUps(): Promise<number> {
    if (this.notifier === null) return 0;
    const now = this.clock();
    const due = await this.leads.dueFollowUps(now, DUE_FOLLOW_UP_BATCH);
    let sent = 0;
    for (const row of due) {
      try {
        await this.leads.markFollowUpReminded(row.userId, row.followUpAt);
        await this.notifier.notify({
          userId: row.assignedTo,
          kind: 'follow_up_due',
          subjectId: row.userId,
          data: { name: row.userName, dueAt: row.followUpAt.toISOString() },
        });
        sent += 1;
      } catch (error: unknown) {
        this.log?.warn({ err: error, userId: row.userId }, 'pengingat tindak lanjut gagal');
      }
    }
    return sent;
  }

  async activity(userId: string, viewer: InternalViewer): Promise<readonly LeadActivity[]> {
    await this.visible(userId, viewer);
    return this.leads.activity(userId);
  }

  /** Paragraf konteks baru dari data terkini; `null` bila model tidak tersedia atau gagal pagar. */
  async refreshContext(userId: string, viewer: InternalViewer): Promise<LeadContext | null> {
    await this.visible(userId, viewer);
    return this.writeContext(userId);
  }

  /**
   * Penugasan dari dashboard admin, lalu paragraf konteks disusun di latar — penugasan tidak
   * menunggu model (di CPU server puluhan detik).
   */
  async assign(userId: string, salesUserId: string, assignedBy: string): Promise<void> {
    await this.board.assign(userId, salesUserId, assignedBy);
    await this.record(userId, { id: assignedBy, roles: [] }, { kind: 'assigned' });
    void this.writeContext(userId).catch((error: unknown) => {
      this.log?.warn({ err: error, userId }, 'ringkasan prospek tidak tersusun');
    });
  }

  async transcript(
    userId: string,
    conversationId: string,
    viewer: InternalViewer,
  ): Promise<readonly TranscriptLine[]> {
    await this.visible(userId, viewer);
    const lines = await this.leads.transcript(userId, conversationId);
    if (lines === null) throw new LeadNotFoundError();
    return lines;
  }

  /** Satu baris jejak. Gagal mencatat tidak membatalkan tindakannya — ia sudah terjadi. */
  private async record(
    userId: string,
    viewer: InternalViewer,
    row: {
      readonly kind: LeadActivity['kind'];
      readonly note?: string | null;
      readonly status?: LeadStatus | null;
      readonly followUpAt?: Date | null;
    },
  ): Promise<void> {
    try {
      await this.leads.appendActivity({
        id: ulid(),
        userId,
        actorId: viewer.id,
        kind: row.kind,
        note: row.note ?? null,
        status: row.status ?? null,
        followUpAt: row.followUpAt ?? null,
      });
    } catch (error: unknown) {
      this.log?.warn({ err: error, userId }, 'jejak tindak lanjut tidak tercatat');
    }
  }

  private async writeContext(userId: string): Promise<LeadContext | null> {
    const text = await this.writer.write(await this.leads.facts(userId));
    if (text === null) return null;
    const context = { text, generatedAt: this.clock().toISOString() };
    await this.leads.setContext(userId, context);
    return context;
  }

  private async visible(userId: string, viewer: InternalViewer): Promise<LeadRecord> {
    const lead = await this.leads.findLead(userId);
    if (lead === null || !canSeeLead(lead, viewer)) throw new LeadNotFoundError();
    return lead;
  }
}
