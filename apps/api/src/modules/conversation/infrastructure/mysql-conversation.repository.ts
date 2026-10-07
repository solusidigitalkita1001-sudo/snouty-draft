/**
 * Implementasi MySQL dari `ConversationRepository`.
 *
 * Paginasi riwayat memakai cursor atas `updated_at` — alasannya sama dengan katalog
 * (OFFSET menggeser halaman saat ada baris baru), tetapi kuncinya waktu karena
 * urutan layar 12 memang "terbaru diperbarui dulu", dan percakapan yang disentuh
 * naik ke atas.
 */
import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, like, lt, type SQL, sql } from 'drizzle-orm';
import type {
  AssistantCard,
  ConversationStage,
  ConversationStatus,
  Locale,
  MessageRole,
} from '@snouty/shared-types';
import { DEFAULT_LOCALE, isLocale } from '@snouty/shared-types';
import { conversations, messages } from '../../../infrastructure/mysql/schema/conversation.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import {
  CONVERSATION_REPOSITORY,
  type ConversationListQuery,
  type ConversationOwner,
  type ConversationRepository,
  type ConversationRow,
  type MessageRow,
} from '../domain/conversation.repository.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

@Injectable()
export class MysqlConversationRepository implements ConversationRepository {
  constructor(private readonly database: QueryRunner) {}

  async create(row: { id: string; owner: ConversationOwner; language: Locale }): Promise<void> {
    await this.database.db.insert(conversations).values({
      id: row.id,
      ownerKind: row.owner.kind,
      ownerId: row.owner.id,
      language: row.language,
    });
  }

  async findById(id: string): Promise<ConversationRow | null> {
    const rows = await this.database.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toConversation(row);
  }

  async list(query: ConversationListQuery): Promise<readonly ConversationRow[]> {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const conditions: SQL[] = [
      eq(conversations.ownerKind, query.owner.kind),
      eq(conversations.ownerId, query.owner.id),
      isNull(conversations.deletedAt),
    ];
    if (query.status !== undefined) conditions.push(eq(conversations.status, query.status));
    if (query.q !== undefined && query.q.trim() !== '') {
      conditions.push(like(conversations.title, `%${escapeLike(query.q.trim())}%`));
    }
    if (query.cursor !== undefined) {
      conditions.push(lt(conversations.updatedAt, new Date(query.cursor)));
    }

    const rows = await this.database.db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
    return rows.map(toConversation);
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await this.database.db.update(conversations).set({ title }).where(eq(conversations.id, id));
  }

  async updateStatus(
    id: string,
    status: ConversationStatus,
    stage?: ConversationStage,
  ): Promise<void> {
    await this.database.db
      .update(conversations)
      .set({ status, ...(stage !== undefined ? { stage } : {}) })
      .where(eq(conversations.id, id));
  }

  async softDelete(id: string): Promise<void> {
    await this.database.db
      .update(conversations)
      .set({ deletedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(conversations.id, id));
  }

  async appendMessage(message: {
    id: string;
    conversationId: string;
    role: MessageRole;
    text: string;
    cards?: readonly AssistantCard[];
    mood?: string | null;
  }): Promise<void> {
    await this.database.db.insert(messages).values({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      text: message.text,
      cards: message.cards ?? [],
      mood: message.mood ?? null,
    });
    // Percakapan yang disentuh naik ke atas riwayat.
    await this.database.db
      .update(conversations)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(eq(conversations.id, message.conversationId));
  }

  async listMessages(conversationId: string): Promise<readonly MessageRow[]> {
    const rows = await this.database.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt, messages.id);
    return rows.map(toMessage);
  }
}

function toConversation(row: typeof conversations.$inferSelect): ConversationRow {
  return {
    id: row.id,
    owner: { kind: row.ownerKind as 'user' | 'guest', id: row.ownerId },
    title: row.title,
    status: row.status as ConversationRow['status'],
    stage: row.stage as ConversationRow['stage'],
    language: isLocale(row.language) ? row.language : DEFAULT_LOCALE,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function toMessage(row: typeof messages.$inferSelect): MessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as MessageRole,
    text: row.text,
    cards: Array.isArray(row.cards) ? (row.cards as AssistantCard[]) : [],
    mood: row.mood,
    createdAt: row.createdAt,
  };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const conversationRepositoryProvider = {
  provide: CONVERSATION_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): ConversationRepository =>
    new MysqlConversationRepository(database),
};
