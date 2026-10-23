import type { Notifier } from '../../../shared/notification/notifier.port.js';
import {
  AccountNotFoundError,
  canBeContacted,
  NotContactableError,
  NotSalesError,
  ProspectNotFoundError,
  type ProspectFilter,
  type ProspectRow,
  type ProspectStore,
  type SalesMember,
} from '../domain/prospect-board.js';
import { assessProspect, STAGES, type Stage } from '../domain/prospect-stage.js';

export interface ProspectBoard {
  /** Jumlah prospek per tahap 5A, sebelum filter — corong di atas papan. */
  readonly funnel: Readonly<Record<Stage, number>>;
  readonly items: readonly ProspectRow[];
}

/**
 * Dashboard admin (P26-05). Penilaian di memori: jumlah pengguna terdaftar masih ratusan, dan setiap
 * angka di papan dihitung dari aturan `prospect-stage` yang sama. Bila pengguna puluhan ribu, nilai ini
 * pindah ke tabel yang diperbarui terjadwal — aturannya tidak berubah.
 */
export class ProspectBoardService {
  constructor(
    private readonly store: ProspectStore,
    /** Pemberitahuan di dalam aplikasi (P27-07); `null` di tes dan di proses tanpa notifikasi. */
    private readonly notifier: Notifier | null = null,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async board(filter: ProspectFilter): Promise<ProspectBoard> {
    const now = this.clock();
    const rows: ProspectRow[] = [];
    for (const record of await this.store.readAll()) {
      const view = assessProspect(record.events, record.scales, now);
      if (view === null) continue;
      rows.push({
        ...view,
        user: record.user,
        salesContactConsent: record.salesContactConsent,
        salesRequestedAt: record.salesRequestedAt,
        contactable: canBeContacted(record),
        conversationCount: record.conversationCount,
        lead: record.lead,
      });
    }
    const funnel = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    for (const row of rows) funnel[row.stage] += 1;
    const q = filter.q?.trim().toLowerCase();
    const items = rows
      .filter((row) => !filter.stage || row.stage === filter.stage)
      .filter((row) => !filter.priority || row.priority === filter.priority)
      .filter((row) => !filter.scale || row.scale === filter.scale)
      .filter(
        (row) => !filter.assignment || (filter.assignment === 'assigned') === (row.lead !== null),
      )
      .filter(
        (row) =>
          !q || row.user.name.toLowerCase().includes(q) || row.user.email.toLowerCase().includes(q),
      )
      .sort((a, b) => b.score - a.score || b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    return { funnel, items };
  }

  /** Menugaskan prospek ke sales — hanya bila ada dasar sah untuk menghubunginya (OQ-76). */
  async assign(userId: string, salesUserId: string, assignedBy: string): Promise<void> {
    const basis = await this.store.contactBasis(userId);
    if (basis === null) throw new ProspectNotFoundError();
    if (!canBeContacted(basis)) throw new NotContactableError();
    if (!(await this.store.isSales(salesUserId))) throw new NotSalesError();
    await this.store.assign({ userId, salesUserId, assignedBy });
    // Sales tahu ada prospek baru tanpa harus membuka papannya (P27-07). Lewat port: modul ini
    // tidak boleh bergantung pada modul notifikasi.
    await this.notifier?.notify({
      userId: salesUserId,
      kind: 'lead_assigned',
      subjectId: userId,
    });
  }

  salesTeam(): Promise<readonly SalesMember[]> {
    return this.store.salesTeam();
  }

  async addSales(email: string, grantedBy: string): Promise<void> {
    const granted = await this.store.grantSales(email.trim().toLowerCase(), grantedBy);
    if (granted === null) throw new AccountNotFoundError();
  }

  /** Penugasan yang ada tetap tercatat; admin memindahkannya ke sales lain. */
  removeSales(userId: string): Promise<void> {
    return this.store.revokeSales(userId);
  }
}
