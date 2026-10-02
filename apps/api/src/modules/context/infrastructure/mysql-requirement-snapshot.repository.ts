/**
 * Implementasi MySQL dari `RequirementSnapshotRepository` — sumber kebenaran
 * snapshot (docs/CONTEXT_ENGINE.md §7).
 *
 * `append` mengandalkan unique index `(conversation_id, version)` untuk menolak
 * versi duplikat; dua giliran yang berlomba menulis versi N yang sama membuat satu
 * gagal dengan ER_DUP_ENTRY, bukan dua-duanya tersimpan diam-diam.
 */
import { Injectable } from '@nestjs/common';
import type { RequirementState } from '@snouty/shared-types';
import { and, desc, eq } from 'drizzle-orm';
import { requirementSnapshots } from '../../../infrastructure/mysql/schema/conversation.js';
import { type QueryRunner } from '../../../shared/database/database.service.js';
import type {
  AppendSnapshotInput,
  RequirementSnapshotRepository,
  RequirementSnapshotRow,
} from '../domain/requirement-snapshot.repository.js';

@Injectable()
export class MysqlRequirementSnapshotRepository implements RequirementSnapshotRepository {
  constructor(private readonly database: QueryRunner) {}

  async append(input: AppendSnapshotInput): Promise<RequirementSnapshotRow> {
    await this.database.db.insert(requirementSnapshots).values({
      id: input.id,
      conversationId: input.conversationId,
      version: input.version,
      state: input.state,
      trigger: input.trigger,
    });
    const row = await this.findByVersion(input.conversationId, input.version);
    if (!row) throw new Error('snapshot hilang tepat setelah ditulis');
    return row;
  }

  async findLatest(conversationId: string): Promise<RequirementSnapshotRow | null> {
    const rows = await this.database.db
      .select()
      .from(requirementSnapshots)
      .where(eq(requirementSnapshots.conversationId, conversationId))
      .orderBy(desc(requirementSnapshots.version))
      .limit(1);
    return rows[0] ? this.toRow(rows[0]) : null;
  }

  async findByVersion(
    conversationId: string,
    version: number,
  ): Promise<RequirementSnapshotRow | null> {
    const rows = await this.database.db
      .select()
      .from(requirementSnapshots)
      .where(
        and(
          eq(requirementSnapshots.conversationId, conversationId),
          eq(requirementSnapshots.version, version),
        ),
      )
      .limit(1);
    return rows[0] ? this.toRow(rows[0]) : null;
  }

  private toRow(row: typeof requirementSnapshots.$inferSelect): RequirementSnapshotRow {
    return {
      id: row.id,
      conversationId: row.conversationId,
      version: row.version,
      state: row.state as RequirementState,
      trigger: row.trigger as RequirementSnapshotRow['trigger'],
      createdAt: row.createdAt,
    };
  }
}

import { DatabaseService } from '../../../shared/database/database.service.js';
import { REQUIREMENT_SNAPSHOT_REPOSITORY } from '../domain/requirement-snapshot.repository.js';

export const requirementSnapshotRepositoryProvider = {
  provide: REQUIREMENT_SNAPSHOT_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService) => new MysqlRequirementSnapshotRepository(database),
};
