/** Implementasi MySQL dari `ShareLinkRepository` (P24-03). */
import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { shareLinks } from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareLinkRow,
} from '../domain/share-link.repository.js';

@Injectable()
export class MysqlShareLinkRepository implements ShareLinkRepository {
  constructor(private readonly database: QueryRunner) {}

  async replace(row: {
    id: string;
    tokenHash: string;
    recommendationId: string;
    conversationId: string;
    ownerId: string;
  }): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(shareLinks)
        .set({ revokedAt: sql`CURRENT_TIMESTAMP(3)` })
        .where(
          and(eq(shareLinks.recommendationId, row.recommendationId), isNull(shareLinks.revokedAt)),
        );
      await tx.insert(shareLinks).values(row);
    });
  }

  async findActiveByHash(tokenHash: string): Promise<ShareLinkRow | null> {
    const rows = await this.database.db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)))
      .limit(1);
    return rows[0] === undefined ? null : toRow(rows[0]);
  }

  async activeFor(recommendationId: string): Promise<ShareLinkRow | null> {
    const rows = await this.database.db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.recommendationId, recommendationId), isNull(shareLinks.revokedAt)))
      .orderBy(desc(shareLinks.createdAt))
      .limit(1);
    return rows[0] === undefined ? null : toRow(rows[0]);
  }

  async revokeFor(recommendationId: string): Promise<void> {
    await this.database.db
      .update(shareLinks)
      .set({ revokedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(and(eq(shareLinks.recommendationId, recommendationId), isNull(shareLinks.revokedAt)));
  }
}

function toRow(row: typeof shareLinks.$inferSelect): ShareLinkRow {
  return {
    id: row.id,
    recommendationId: row.recommendationId,
    conversationId: row.conversationId,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

export const shareLinkRepositoryProvider = {
  provide: SHARE_LINK_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ShareLinkRepository =>
    new MysqlShareLinkRepository(database),
};
