/**
 * Implementasi MySQL dari `ReportRepository`.
 *
 * Alokasi nomor memakai `SELECT … FOR UPDATE` di dalam transaksi. `INSERT … ON
 * DUPLICATE KEY UPDATE` sendirian tidak cukup: dua permintaan bisa sama-sama membaca
 * `last_seq` yang sama sebelum salah satunya menulis. Penguncian baris yang membuat
 * keduanya berbaris.
 */
import { Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import {
  reportNumberCounters,
  reports,
} from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  REPORT_REPOSITORY,
  type CreateReportInput,
  type ReportRepository,
} from '../domain/report.repository.js';
import type { Report, ReportPayload, ReportStatus } from '../domain/report.types.js';

@Injectable()
export class MysqlReportRepository implements ReportRepository {
  constructor(private readonly database: DatabaseService) {}

  async allocateNumber(yearMonth: string): Promise<number> {
    return this.database.db.transaction(async (tx) => {
      // Pastikan barisnya ada sebelum dikunci — `FOR UPDATE` atas baris yang belum
      // ada tidak mengunci apa pun (gap lock saja), dan dua permintaan pertama di
      // bulan baru akan lolos berdua.
      await tx
        .insert(reportNumberCounters)
        .values({ yearMonth, lastSeq: 0 })
        .onDuplicateKeyUpdate({ set: { yearMonth } });

      // `year_month` di-backtick: MySQL memperlakukan YEAR_MONTH sebagai kata kunci
      // (unit INTERVAL), jadi tanpa backtick pernyataan ini gagal parse.
      const locked = await tx.execute(
        sql`SELECT \`last_seq\` FROM \`report_number_counters\` WHERE \`year_month\` = ${yearMonth} FOR UPDATE`,
      );
      const current = Number(
        (locked[0] as unknown as Array<{ last_seq?: number; LAST_SEQ?: number }>)[0]?.last_seq ?? 0,
      );
      const next = current + 1;

      await tx
        .update(reportNumberCounters)
        .set({ lastSeq: next })
        .where(eq(reportNumberCounters.yearMonth, yearMonth));

      return next;
    });
  }

  async create(input: CreateReportInput): Promise<Report> {
    await this.database.db.insert(reports).values({
      id: input.id,
      recommendationId: input.recommendationId,
      reportNumber: input.reportNumber,
      payloadJson: input.payload,
    });
    const created = await this.findById(input.id);
    if (!created) throw new Error('laporan hilang tepat setelah dibuat');
    return created;
  }

  async findById(id: string): Promise<Report | null> {
    const rows = await this.database.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return rows[0] ? toReport(rows[0]) : null;
  }

  async findByRecommendation(recommendationId: string): Promise<readonly Report[]> {
    const rows = await this.database.db
      .select()
      .from(reports)
      .where(eq(reports.recommendationId, recommendationId))
      .orderBy(desc(reports.createdAt));
    return rows.map(toReport);
  }

  async markStatus(
    id: string,
    status: ReportStatus,
    detail: { fileRef?: string; failureReason?: string },
  ): Promise<void> {
    await this.database.db
      .update(reports)
      .set({
        status,
        ...(detail.fileRef !== undefined ? { fileRef: detail.fileRef } : {}),
        ...(detail.failureReason !== undefined ? { failureReason: detail.failureReason } : {}),
        // Jam basis data, bukan jam Node — sama seperti consent (menghindari selisih).
        completedAt: status === 'PENDING' ? null : sql`CURRENT_TIMESTAMP(3)`,
      })
      .where(eq(reports.id, id));
  }
}

function toReport(row: typeof reports.$inferSelect): Report {
  return {
    id: row.id,
    recommendationId: row.recommendationId,
    reportNumber: row.reportNumber,
    status: row.status as ReportStatus,
    payload: row.payloadJson as ReportPayload,
    fileRef: row.fileRef,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export const reportRepositoryProvider = {
  provide: REPORT_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ReportRepository => new MysqlReportRepository(database),
};
