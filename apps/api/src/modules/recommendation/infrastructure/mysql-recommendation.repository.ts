/**
 * Implementasi MySQL dari `RecommendationRepository`.
 *
 * Rekomendasi dan trace-nya ditulis dalam **satu transaksi**: rekomendasi tanpa trace
 * akan melanggar invarian T-1 (setiap nilai yang tampil punya trace), dan trace tanpa
 * rekomendasi adalah baris yatim yang tidak pernah terbaca.
 */
import { Injectable } from '@nestjs/common';
import type { Recommendation } from '@snouty/shared-types';
import { desc, eq } from 'drizzle-orm';
import {
  calculationTraces,
  recommendations,
} from '../../../infrastructure/mysql/schema/recommendation.js';
import { DatabaseService } from '../../../shared/database/database.service.js';
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
  type TraceToSave,
} from '../domain/recommendation.repository.js';

@Injectable()
export class MysqlRecommendationRepository implements RecommendationRepository {
  constructor(private readonly database: DatabaseService) {}

  async save(recommendation: Recommendation, traces: readonly TraceToSave[]): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      await tx.insert(recommendations).values({
        id: recommendation.id,
        conversationId: recommendation.conversationId,
        snapshotId: recommendation.snapshotId,
        catalogVersionId: recommendation.catalogVersionId,
        headline: recommendation.headline,
        body: recommendation.body,
        stats: recommendation.stats,
        systemLines: recommendation.systemLines,
        products: recommendation.products,
        bom: recommendation.bom,
        assumptions: recommendation.assumptions,
        overallProvenance: recommendation.overallProvenance,
      });

      if (traces.length > 0) {
        await tx.insert(calculationTraces).values(
          traces.map((trace) => ({
            id: trace.id,
            recommendationId: recommendation.id,
            ruleId: trace.ruleId,
            ruleVersion: String(trace.ruleVersion),
            inputs: trace.inputs,
            output: trace.output,
            provenance: trace.provenance,
            explanation: trace.explanation,
          })),
        );
      }
    });
  }

  async findById(id: string): Promise<Recommendation | null> {
    const rows = await this.database.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);
    return rows[0] ? toRecommendation(rows[0]) : null;
  }

  async findLatestForConversation(conversationId: string): Promise<Recommendation | null> {
    const rows = await this.database.db
      .select()
      .from(recommendations)
      .where(eq(recommendations.conversationId, conversationId))
      .orderBy(desc(recommendations.createdAt))
      .limit(1);
    return rows[0] ? toRecommendation(rows[0]) : null;
  }

  async findTraces(recommendationId: string): Promise<readonly TraceToSave[]> {
    const rows = await this.database.db
      .select()
      .from(calculationTraces)
      .where(eq(calculationTraces.recommendationId, recommendationId));
    return rows.map((row) => ({
      id: row.id,
      ruleId: row.ruleId,
      ruleVersion: Number(row.ruleVersion),
      inputs: row.inputs,
      output: row.output,
      provenance: row.provenance as TraceToSave['provenance'],
      explanation: row.explanation,
    }));
  }
}

function toRecommendation(row: typeof recommendations.$inferSelect): Recommendation {
  return {
    id: row.id,
    conversationId: row.conversationId,
    snapshotId: row.snapshotId,
    catalogVersionId: row.catalogVersionId,
    headline: row.headline,
    body: row.body,
    stats: row.stats as Recommendation['stats'],
    systemLines: row.systemLines as Recommendation['systemLines'],
    products: row.products as Recommendation['products'],
    bom: row.bom as Recommendation['bom'],
    assumptions: row.assumptions as Recommendation['assumptions'],
    overallProvenance: row.overallProvenance as Recommendation['overallProvenance'],
    createdAt: row.createdAt.toISOString(),
  };
}

export const recommendationRepositoryProvider = {
  provide: RECOMMENDATION_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): RecommendationRepository =>
    new MysqlRecommendationRepository(database),
};
