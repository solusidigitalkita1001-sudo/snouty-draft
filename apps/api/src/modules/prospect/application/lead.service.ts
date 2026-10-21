import type { Logger } from 'pino';
import {
  canSeeLead,
  LeadNotFoundError,
  LostReasonRequiredError,
  validStatusChange,
  type InternalViewer,
  type LeadContext,
  type LeadFacts,
  type LeadRecord,
  type LeadStore,
  type TranscriptLine,
} from '../domain/lead.js';
import type { LeadStatus, ProspectRow } from '../domain/prospect-board.js';
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
    private readonly log: Pick<Logger, 'warn'> | null = null,
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
    await this.leads.setStatus(userId, status, status === 'lost' ? lostReason!.trim() : null);
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
