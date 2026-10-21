/**
 * Membaca fakta konsultasi DI DALAM konteks percakapan lalu menulis event pasar tanpa identitas
 * (P26-07, docs/MARKET_INTELLIGENCE.md §4). Id percakapan berhenti di sini: tidak ada di event, log,
 * maupun nilai balik.
 */
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import { marketEvents, salesRequests } from '../../../infrastructure/mysql/schema/intelligence.js';
import { recommendations } from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import type { ConsultationFacts } from '../domain/chat-event.js';
import type { MarketEvent, MarketInstallationType, ProjectScale } from '../domain/market-event.js';

const json = (path: string) =>
  sql<
    string | null
  >`JSON_UNQUOTE(JSON_EXTRACT(${requirementSnapshots.state}, ${sql.raw(`'${path}'`)}))`;

const value = (raw: string | null | undefined) =>
  raw === null || raw === undefined || raw === 'null' ? null : raw;
const number = (raw: string | null | undefined) => {
  const v = value(raw);
  const n = Number(v);
  return v !== null && Number.isFinite(n) ? n : null;
};

export class MysqlMarketEventStore {
  constructor(private readonly database: Pick<DatabaseService, 'db'>) {}

  private get db() {
    return this.database.db;
  }

  /**
   * Menandai konsultasi sebagai sudah dicatat — atomik, sehingga dua permintaan bersamaan tidak
   * melahirkan dua event. `false` bila sudah pernah dicatat.
   */
  async claim(conversationId: string): Promise<boolean> {
    const [result] = await this.db
      .update(conversations)
      .set({ marketRecordedAt: sql`CURRENT_TIMESTAMP(3)` })
      .where(and(eq(conversations.id, conversationId), isNull(conversations.marketRecordedAt)));
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  async facts(conversationId: string): Promise<ConsultationFacts> {
    const [snap] = await this.db
      .select({
        buildingType: json('$.building.type.value'),
        floors: json('$.building.floors.value'),
        outletCount: json('$.fixtures.outletCount.value'),
        installationType: json('$.water.installationType.value'),
        caseId: json('$.useCase.caseId'),
        useCaseKind: json('$.useCase.kind'),
      })
      .from(requirementSnapshots)
      .where(eq(requirementSnapshots.conversationId, conversationId))
      .orderBy(desc(requirementSnapshots.version))
      .limit(1);
    const [rec] = await this.db
      .select({ stats: recommendations.stats, products: recommendations.products })
      .from(recommendations)
      .where(eq(recommendations.conversationId, conversationId))
      .orderBy(desc(recommendations.createdAt))
      .limit(1);
    const [price] = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.conversationId, conversationId), eq(messages.intent, 'price_question')),
      )
      .limit(1);
    const [request] = await this.db
      .select({ id: salesRequests.id })
      .from(salesRequests)
      .where(eq(salesRequests.conversationId, conversationId))
      .limit(1);

    const stats = (rec?.stats ?? {}) as { outletCount?: unknown };
    const products = Array.isArray(rec?.products) ? (rec.products as unknown[]) : [];
    return {
      buildingType: value(snap?.buildingType),
      floors: number(snap?.floors),
      outletCount:
        typeof stats.outletCount === 'number' ? stats.outletCount : number(snap?.outletCount),
      installationType: value(snap?.installationType),
      caseId: value(snap?.useCaseKind) === 'irrigation' ? 'irrigation' : value(snap?.caseId),
      products: products.map((raw) => {
        const item = (typeof raw === 'object' && raw !== null ? raw : {}) as {
          family?: unknown;
          size?: unknown;
        };
        return {
          family: typeof item.family === 'string' ? item.family : null,
          size: typeof item.size === 'string' ? item.size : null,
        };
      }),
      quotationIntent: price !== undefined || request !== undefined,
    };
  }

  async insert(event: MarketEvent): Promise<void> {
    await this.db.insert(marketEvents).values({
      id: event.id,
      source: event.source,
      occurredOn: new Date(`${event.occurredOn}T00:00:00Z`),
      region: event.region,
      buildingType: event.buildingType,
      projectScale: event.projectScale,
      installationType: event.installationType,
      outletCount: event.outletCount,
      floors: event.floors,
      productInterest: event.productInterest,
      quotationIntent: event.quotationIntent,
      reachedSolution: event.reachedSolution,
      routedToTechnical: event.routedToTechnical,
    });
  }

  /** Event sejak `fromDay` (YYYY-MM-DD) — bahan agregat dashboard pasar. */
  async since(fromDay: string): Promise<readonly MarketEvent[]> {
    const rows = await this.db
      .select()
      .from(marketEvents)
      .where(gte(marketEvents.occurredOn, new Date(`${fromDay}T00:00:00Z`)));
    return rows.map((row) => ({
      id: row.id,
      source: row.source === 'email' ? 'email' : 'chat',
      occurredOn: toDay(row.occurredOn),
      region: row.region,
      buildingType: row.buildingType,
      projectScale: row.projectScale as ProjectScale | null,
      installationType: row.installationType as MarketInstallationType | null,
      outletCount: row.outletCount,
      floors: row.floors,
      productInterest: Array.isArray(row.productInterest)
        ? (row.productInterest as unknown[]).filter((k): k is string => typeof k === 'string')
        : [],
      quotationIntent: Boolean(row.quotationIntent),
      reachedSolution: Boolean(row.reachedSolution),
      routedToTechnical: Boolean(row.routedToTechnical),
    }));
  }
}

function toDay(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}
