import { asc, eq, lte } from 'drizzle-orm';
import { uploads } from '../../../infrastructure/mysql/schema/conversation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import type { AllowedMime } from '../domain/upload-policy.js';
import {
  UPLOAD_REPOSITORY,
  type UploadRepository,
  type UploadRow,
} from '../domain/upload.repository.js';

export class MysqlUploadRepository implements UploadRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(row: Omit<UploadRow, 'createdAt'>): Promise<void> {
    await this.database.db.insert(uploads).values({
      id: row.id,
      conversationId: row.conversationId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      expiresAt: row.expiresAt,
    });
  }

  async findById(id: string): Promise<UploadRow | null> {
    const rows = await this.database.db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async listForConversation(conversationId: string): Promise<readonly UploadRow[]> {
    const rows = await this.database.db
      .select()
      .from(uploads)
      .where(eq(uploads.conversationId, conversationId))
      .orderBy(asc(uploads.createdAt));
    return rows.map(toRow);
  }

  async listExpired(now: Date, limit: number): Promise<readonly UploadRow[]> {
    const rows = await this.database.db
      .select()
      .from(uploads)
      .where(lte(uploads.expiresAt, now))
      .orderBy(asc(uploads.expiresAt))
      .limit(limit);
    return rows.map(toRow);
  }

  async delete(id: string): Promise<void> {
    await this.database.db.delete(uploads).where(eq(uploads.id, id));
  }
}

function toRow(row: typeof uploads.$inferSelect): UploadRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    originalName: row.originalName,
    mimeType: row.mimeType as AllowedMime,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export const uploadRepositoryProvider = {
  provide: UPLOAD_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): UploadRepository => new MysqlUploadRepository(database),
};
