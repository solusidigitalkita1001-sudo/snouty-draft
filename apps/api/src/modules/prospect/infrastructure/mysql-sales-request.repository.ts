import { and, desc, eq, gte } from 'drizzle-orm';
import { salesRequests } from '../../../infrastructure/mysql/schema/intelligence.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  SALES_REQUEST_REPOSITORY,
  type SalesRequestRepository,
  type SalesRequestRow,
  type SalesRequestSource,
} from '../domain/sales-request.repository.js';

export class MysqlSalesRequestRepository implements SalesRequestRepository {
  constructor(private readonly database: Pick<DatabaseService, 'db'>) {}

  async create(row: Omit<SalesRequestRow, 'createdAt'>): Promise<void> {
    await this.database.db.insert(salesRequests).values(row);
  }

  async latestSince(
    userId: string,
    conversationId: string,
    since: Date,
  ): Promise<SalesRequestRow | null> {
    const rows = await this.database.db
      .select()
      .from(salesRequests)
      .where(
        and(
          eq(salesRequests.userId, userId),
          eq(salesRequests.conversationId, conversationId),
          gte(salesRequests.createdAt, since),
        ),
      )
      .orderBy(desc(salesRequests.createdAt))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async findById(id: string): Promise<SalesRequestRow | null> {
    const rows = await this.database.db
      .select()
      .from(salesRequests)
      .where(eq(salesRequests.id, id))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }
}

function toRow(row: typeof salesRequests.$inferSelect): SalesRequestRow {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    source: toSource(row.source),
    createdAt: row.createdAt,
  };
}

function toSource(raw: string): SalesRequestSource {
  if (raw === 'solution' || raw === 'price') return raw;
  throw new Error(`sumber permintaan sales tidak dikenal di database: ${raw}`);
}

export const salesRequestRepositoryProvider = {
  provide: SALES_REQUEST_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): SalesRequestRepository =>
    new MysqlSalesRequestRepository(database),
};
