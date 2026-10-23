/**
 * Data lead untuk dashboard sales (P26-06): penugasan, status, paragraf konteks, dan fakta ringkasan
 * dari snapshot kebutuhan serta rekomendasi terakhir tiap konsultasi pengguna.
 */
import { and, count, desc, eq, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import {
  leadActivities,
  salesLeads,
  salesRequests,
} from '../../../infrastructure/mysql/schema/intelligence.js';
import { users } from '../../../infrastructure/mysql/schema/identity.js';
import {
  recommendations,
  reports,
  shareLinks,
} from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  LEAD_STORE,
  type DueFollowUp,
  type LeadContext,
  type LeadFacts,
  type LeadProject,
  type LeadRecord,
  type LeadActivity,
  type LeadStore,
  type NewLeadActivity,
  type TranscriptLine,
} from '../domain/lead.js';
import { LEAD_STATUSES, type LeadStatus } from '../domain/prospect-board.js';

/** Konsultasi terbaru yang diringkas — sales butuh gambaran, bukan arsip. */
const MAX_PROJECTS = 8;
const MAX_PRODUCTS = 6;
const MAX_QUOTES = 5;
const MAX_QUOTE_CHARS = 200;
/** Jejak yang dibawa sekali tarik — layar sales butuh riwayat, bukan arsip. */
const MAX_ACTIVITY = 50;

const json = (path: string) =>
  sql<
    string | null
  >`JSON_UNQUOTE(JSON_EXTRACT(${requirementSnapshots.state}, ${sql.raw(`'${path}'`)}))`;

export class MysqlLeadStore implements LeadStore {
  constructor(private readonly database: Pick<DatabaseService, 'db'>) {}

  private get db() {
    return this.database.db;
  }

  private owned(userId: string) {
    return and(
      eq(conversations.ownerKind, 'user'),
      eq(conversations.ownerId, userId),
      isNull(conversations.deletedAt),
    );
  }

  async findLead(userId: string): Promise<LeadRecord | null> {
    const [row] = await this.db
      .select()
      .from(salesLeads)
      .where(eq(salesLeads.userId, userId))
      .limit(1);
    if (!row) return null;
    return {
      userId: row.userId,
      assignedTo: row.assignedTo,
      status: toStatus(row.status),
      lostReason: row.lostReason,
      assignedAt: row.updatedAt,
      context: toContext(row.summary),
      followUpAt: row.followUpAt,
    };
  }

  /** Jejak tindak lanjut, terbaru dulu — urut `id` ULID, bukan stempel waktu (P27-09). */
  async activity(userId: string): Promise<readonly LeadActivity[]> {
    const rows = await this.db
      .select({
        id: leadActivities.id,
        kind: leadActivities.kind,
        actorId: leadActivities.actorId,
        actorName: users.name,
        note: leadActivities.note,
        status: leadActivities.status,
        followUpAt: leadActivities.followUpAt,
        at: leadActivities.createdAt,
      })
      .from(leadActivities)
      .leftJoin(users, eq(users.id, leadActivities.actorId))
      .where(eq(leadActivities.userId, userId))
      .orderBy(desc(leadActivities.id))
      .limit(MAX_ACTIVITY);
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as LeadActivity['kind'],
      actorId: row.actorId,
      actorName: row.actorName,
      note: row.note,
      status: row.status === null ? null : toStatus(row.status),
      followUpAt: row.followUpAt,
      at: row.at,
    }));
  }

  async appendActivity(row: NewLeadActivity): Promise<void> {
    await this.db.insert(leadActivities).values({
      id: row.id,
      userId: row.userId,
      actorId: row.actorId,
      kind: row.kind,
      note: row.note,
      status: row.status,
      followUpAt: row.followUpAt,
    });
  }

  async setFollowUp(userId: string, at: Date | null): Promise<void> {
    await this.db.update(salesLeads).set({ followUpAt: at }).where(eq(salesLeads.userId, userId));
  }

  /**
   * Yang jatuh tempo dan belum diingatkan (P28-01). Prospek yang sudah menang atau kalah tidak
   * ikut: jadwal tengok yang tertinggal di sana bukan pekerjaan yang tersisa.
   */
  async dueFollowUps(now: Date, limit: number): Promise<readonly DueFollowUp[]> {
    const rows = await this.db
      .select({
        userId: salesLeads.userId,
        assignedTo: salesLeads.assignedTo,
        followUpAt: salesLeads.followUpAt,
        userName: users.name,
      })
      .from(salesLeads)
      .leftJoin(users, eq(users.id, salesLeads.userId))
      .where(
        and(
          lte(salesLeads.followUpAt, now),
          inArray(salesLeads.status, ['new', 'contacted', 'quoted']),
          or(
            isNull(salesLeads.followUpRemindedFor),
            ne(salesLeads.followUpRemindedFor, salesLeads.followUpAt),
          ),
        ),
      )
      .orderBy(salesLeads.followUpAt)
      .limit(limit);
    return rows.flatMap((row) =>
      row.followUpAt === null
        ? []
        : [
            {
              userId: row.userId,
              assignedTo: row.assignedTo,
              followUpAt: row.followUpAt,
              userName: row.userName,
            },
          ],
    );
  }

  async markFollowUpReminded(userId: string, followUpAt: Date): Promise<void> {
    await this.db
      .update(salesLeads)
      .set({ followUpRemindedFor: followUpAt })
      .where(and(eq(salesLeads.userId, userId), eq(salesLeads.followUpAt, followUpAt)));
  }

  async setStatus(userId: string, status: LeadStatus, lostReason: string | null): Promise<void> {
    await this.db
      .update(salesLeads)
      .set({ status, lostReason })
      .where(eq(salesLeads.userId, userId));
  }

  async setContext(userId: string, context: LeadContext): Promise<void> {
    await this.db.update(salesLeads).set({ summary: context }).where(eq(salesLeads.userId, userId));
  }

  async facts(userId: string): Promise<LeadFacts> {
    const convs = await this.db
      .select({
        id: conversations.id,
        title: conversations.title,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(this.owned(userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(MAX_PROJECTS);
    const ids = convs.map((c) => c.id);

    const snapshots = ids.length
      ? await this.db
          .select({
            conversationId: requirementSnapshots.conversationId,
            buildingType: json('$.building.type.value'),
            floors: json('$.building.floors.value'),
            bathrooms: json('$.fixtures.bathrooms.value'),
            waterSource: json('$.water.source.value'),
            caseId: json('$.useCase.caseId'),
            useCaseKind: json('$.useCase.kind'),
          })
          .from(requirementSnapshots)
          .where(
            and(
              inArray(requirementSnapshots.conversationId, ids),
              sql`${requirementSnapshots.version} = (SELECT MAX(s2.version) FROM requirement_snapshots s2 WHERE s2.conversation_id = ${requirementSnapshots.conversationId})`,
            ),
          )
      : [];
    const latestRecs = ids.length
      ? await this.db
          .select({
            conversationId: recommendations.conversationId,
            headline: recommendations.headline,
            stats: recommendations.stats,
            products: recommendations.products,
          })
          .from(recommendations)
          .where(
            and(
              inArray(recommendations.conversationId, ids),
              sql`${recommendations.createdAt} = (SELECT MAX(r2.created_at) FROM recommendations r2 WHERE r2.conversation_id = ${recommendations.conversationId})`,
            ),
          )
      : [];

    const projects: LeadProject[] = convs.map((conv) => {
      const snap = snapshots.find((s) => s.conversationId === conv.id);
      const rec = latestRecs.find((r) => r.conversationId === conv.id);
      const value = (raw: string | null | undefined) =>
        raw === null || raw === undefined || raw === 'null' ? null : raw;
      const number = (raw: string | null | undefined) => {
        const n = Number(value(raw));
        return value(raw) !== null && Number.isFinite(n) ? n : null;
      };
      const stats = (rec?.stats ?? {}) as { mainSize?: unknown };
      const products = Array.isArray(rec?.products) ? (rec.products as unknown[]) : [];
      return {
        conversationId: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        buildingType: value(snap?.buildingType),
        floors: number(snap?.floors),
        bathrooms: number(snap?.bathrooms),
        waterSource: value(snap?.waterSource),
        caseId: value(snap?.useCaseKind) === 'irrigation' ? 'irrigation' : value(snap?.caseId),
        headline: rec?.headline ?? null,
        mainSize: typeof stats.mainSize === 'string' ? stats.mainSize : null,
        products: products
          .slice(0, MAX_PRODUCTS)
          .map(toProduct)
          .filter((p) => p !== null),
      };
    });

    const [reportRow] = await this.db
      .select({ n: count() })
      .from(reports)
      .innerJoin(recommendations, eq(reports.recommendationId, recommendations.id))
      .innerJoin(conversations, eq(recommendations.conversationId, conversations.id))
      .where(this.owned(userId));
    const [shareRow] = await this.db
      .select({ n: count() })
      .from(shareLinks)
      .where(eq(shareLinks.ownerId, userId));
    const [request] = await this.db
      .select({ source: salesRequests.source, at: salesRequests.createdAt })
      .from(salesRequests)
      .where(eq(salesRequests.userId, userId))
      .orderBy(desc(salesRequests.createdAt))
      .limit(1);
    const quotes = await this.db
      .select({ text: messages.text, at: messages.createdAt })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(this.owned(userId), eq(messages.role, 'user')))
      .orderBy(desc(messages.createdAt))
      .limit(MAX_QUOTES);

    return {
      projects,
      reports: reportRow?.n ?? 0,
      shares: shareRow?.n ?? 0,
      salesRequest: request ? { source: request.source, at: request.at } : null,
      quotes: quotes.map((q) => ({ text: q.text.slice(0, MAX_QUOTE_CHARS), at: q.at })).reverse(),
    };
  }

  async transcript(
    userId: string,
    conversationId: string,
  ): Promise<readonly TranscriptLine[] | null> {
    const [conv] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(this.owned(userId), eq(conversations.id, conversationId)))
      .limit(1);
    if (!conv) return null;
    const rows = await this.db
      .select({ role: messages.role, text: messages.text, at: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return rows.map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'user',
      text: row.text,
      at: row.at,
    }));
  }
}

function toProduct(raw: unknown): LeadProject['products'][number] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as { name?: unknown; family?: unknown; size?: unknown };
  if (typeof item.name !== 'string') return null;
  return {
    name: item.name,
    family: typeof item.family === 'string' ? item.family : null,
    size: typeof item.size === 'string' ? item.size : null,
  };
}

function toContext(raw: unknown): LeadContext | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as { text?: unknown; generatedAt?: unknown };
  return typeof item.text === 'string' && typeof item.generatedAt === 'string'
    ? { text: item.text, generatedAt: item.generatedAt }
    : null;
}

function toStatus(raw: string): LeadStatus {
  const status = LEAD_STATUSES.find((s) => s === raw);
  if (status === undefined) throw new Error(`status prospek tidak dikenal di database: ${raw}`);
  return status;
}

export const leadStoreProvider = {
  provide: LEAD_STORE,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): LeadStore => new MysqlLeadStore(database),
};
