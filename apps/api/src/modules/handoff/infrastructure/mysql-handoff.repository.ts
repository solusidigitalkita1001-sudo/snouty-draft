import { Injectable } from '@nestjs/common';
import type { KeyValue } from '@snouty/shared-types';
import { asc, eq } from 'drizzle-orm';
import { technicalHandoffs } from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  HANDOFF_REPOSITORY,
  type EnqueueHandoffInput,
  type HandoffRepository,
  type HandoffRow,
} from '../domain/handoff.repository.js';

const DEFAULT_LIMIT = 50;

@Injectable()
export class MysqlHandoffRepository implements HandoffRepository {
  constructor(private readonly database: DatabaseService) {}

  async enqueue(input: EnqueueHandoffInput): Promise<HandoffRow> {
    await this.database.db.insert(technicalHandoffs).values({
      id: input.id,
      conversationId: input.conversationId,
      reason: input.reason,
      capturedJson: input.captured,
    });
    const row = await this.findById(input.id);
    if (!row) throw new Error('handoff hilang tepat setelah dibuat');
    return row;
  }

  async findById(id: string): Promise<HandoffRow | null> {
    const rows = await this.database.db
      .select()
      .from(technicalHandoffs)
      .where(eq(technicalHandoffs.id, id))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async listQueued(limit = DEFAULT_LIMIT): Promise<readonly HandoffRow[]> {
    const rows = await this.database.db
      .select()
      .from(technicalHandoffs)
      .where(eq(technicalHandoffs.status, 'QUEUED'))
      .orderBy(asc(technicalHandoffs.createdAt))
      .limit(limit);
    return rows.map(toRow);
  }

  async findForConversation(conversationId: string): Promise<readonly HandoffRow[]> {
    const rows = await this.database.db
      .select()
      .from(technicalHandoffs)
      .where(eq(technicalHandoffs.conversationId, conversationId))
      .orderBy(asc(technicalHandoffs.createdAt));
    return rows.map(toRow);
  }
}

function toRow(row: typeof technicalHandoffs.$inferSelect): HandoffRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    reason: row.reason,
    captured: row.capturedJson as readonly KeyValue[],
    status: row.status as HandoffRow['status'],
    assignedTo: row.assignedTo,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

export const handoffRepositoryProvider = {
  provide: HANDOFF_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): HandoffRepository =>
    new MysqlHandoffRepository(database),
};
