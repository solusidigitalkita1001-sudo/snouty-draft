/** Implementasi MySQL dari `ProjectRepository` (P24-02). */
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { conversations, projects } from '../../../infrastructure/mysql/schema/conversation.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
  type ProjectRow,
  type ProjectWithCount,
} from '../domain/project.repository.js';

@Injectable()
export class MysqlProjectRepository implements ProjectRepository {
  constructor(private readonly database: QueryRunner) {}

  async create(row: {
    id: string;
    ownerId: string;
    name: string;
    notes: string | null;
  }): Promise<void> {
    await this.database.db.insert(projects).values(row);
  }

  async findById(id: string): Promise<ProjectRow | null> {
    const rows = await this.database.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toProject(row);
  }

  async list(ownerId: string): Promise<readonly ProjectWithCount[]> {
    const rows = await this.database.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt))
      .limit(100);
    if (rows.length === 0) return [];
    const counts = await this.database.db
      .select({ projectId: conversations.projectId, n: count() })
      .from(conversations)
      .where(
        and(
          inArray(
            conversations.projectId,
            rows.map((r) => r.id),
          ),
          isNull(conversations.deletedAt),
        ),
      )
      .groupBy(conversations.projectId);
    const byId = new Map(counts.map((c) => [c.projectId, Number(c.n)]));
    return rows.map((row) => ({ ...toProject(row), conversationCount: byId.get(row.id) ?? 0 }));
  }

  async update(id: string, patch: { name?: string; notes?: string | null }): Promise<void> {
    if (patch.name === undefined && patch.notes === undefined) return;
    await this.database.db
      .update(projects)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      })
      .where(eq(projects.id, id));
  }

  async softDelete(id: string): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ deletedAt: sql`CURRENT_TIMESTAMP(3)` })
        .where(eq(projects.id, id));
      // Konsultasi tetap milik pemiliknya dan tetap di riwayat — hanya dilepas dari proyek.
      await tx
        .update(conversations)
        .set({ projectId: null, updatedAt: sql`updated_at` })
        .where(eq(conversations.projectId, id));
    });
  }

  async touch(id: string): Promise<void> {
    await this.database.db
      .update(projects)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(projects.id, id));
  }
}

function toProject(row: typeof projects.$inferSelect): ProjectRow {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export const projectRepositoryProvider = {
  provide: PROJECT_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ProjectRepository =>
    new MysqlProjectRepository(database),
};
