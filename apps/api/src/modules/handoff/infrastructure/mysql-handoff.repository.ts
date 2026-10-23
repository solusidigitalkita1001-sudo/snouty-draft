import { Injectable } from '@nestjs/common';
import type { KeyValue } from '@snouty/shared-types';
import { and, asc, desc, eq, inArray, notInArray, type SQL } from 'drizzle-orm';
import { conversations } from '../../../infrastructure/mysql/schema/conversation.js';
import { users } from '../../../infrastructure/mysql/schema/identity.js';
import { technicalHandoffs } from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  HANDOFF_REPOSITORY,
  OPEN_HANDOFF_STATUSES,
  type EnqueueHandoffInput,
  type HandoffQueueRow,
  type HandoffRepository,
  type HandoffRow,
  type HandoffStatus,
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

  async listOpen(limit = DEFAULT_LIMIT): Promise<readonly HandoffQueueRow[]> {
    return this.listWithSubmitter(
      inArray(technicalHandoffs.status, [...OPEN_HANDOFF_STATUSES]),
      asc(technicalHandoffs.createdAt),
      limit,
    );
  }

  async listClosed(limit = DEFAULT_LIMIT): Promise<readonly HandoffQueueRow[]> {
    return this.listWithSubmitter(
      notInArray(technicalHandoffs.status, [...OPEN_HANDOFF_STATUSES]),
      desc(technicalHandoffs.createdAt),
      limit,
    );
  }

  /**
   * Satu query, bukan N+1: antrean yang menampilkan lima puluh kasus tidak boleh berarti
   * lima puluh pencarian pengguna. Tamu tidak punya baris `users`, dan `LEFT JOIN`
   * membiarkannya lewat sebagai kontak kosong — bukan sebagai kasus yang hilang.
   */
  private async listWithSubmitter(
    where: SQL | undefined,
    order: SQL,
    limit: number,
  ): Promise<readonly HandoffQueueRow[]> {
    const rows = await this.database.db
      .select({ handoff: technicalHandoffs, user: users })
      .from(technicalHandoffs)
      .innerJoin(conversations, eq(conversations.id, technicalHandoffs.conversationId))
      .leftJoin(
        users,
        and(eq(conversations.ownerKind, 'user'), eq(users.id, conversations.ownerId)),
      )
      .where(where)
      .orderBy(order)
      .limit(limit);

    return rows.map((row) => ({
      ...toRow(row.handoff),
      submitter: row.user
        ? { name: row.user.name, email: row.user.email, phone: row.user.phone }
        : null,
    }));
  }

  async setStatus(
    id: string,
    status: HandoffStatus,
    assignedTo: string | null,
  ): Promise<HandoffRow> {
    const closed = !OPEN_HANDOFF_STATUSES.includes(status);
    await this.database.db
      .update(technicalHandoffs)
      .set({ status, assignedTo, resolvedAt: closed ? new Date() : null })
      .where(eq(technicalHandoffs.id, id));
    const row = await this.findById(id);
    if (!row) throw new Error('handoff hilang saat statusnya diubah');
    return row;
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
