/**
 * OQ-44 — asal prosa tersimpan bersama rekomendasinya, bukan di `llm_calls`.
 *
 * Yang dipaku: `save` menulis `prose_source` persis seperti yang dilaporkan perakitan,
 * dan rekomendasi yang dibaca kembali tidak berubah karenanya — kolom ini metrik audit,
 * bukan bagian dari `Recommendation` yang sampai ke klien.
 */
import type { Recommendation } from '@snouty/shared-types';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../../test/mysql.js';
import { conversations, recommendations } from '../../../infrastructure/mysql/schema/index.js';
import { ulid } from '../../../shared/ulid.js';
import type { ProseSource } from '../domain/recommendation.repository.js';
import { MysqlRecommendationRepository } from './mysql-recommendation.repository.js';

const mysql = await createTestDatabase('recommendations');
const repository = new MysqlRecommendationRepository({ db: mysql.db } as never);

async function seedConversation(): Promise<string> {
  const conversationId = ulid();
  await mysql.db
    .insert(conversations)
    .values({ id: conversationId, ownerKind: 'guest', ownerId: ulid() });
  return conversationId;
}

function recommendationFor(conversationId: string): Recommendation {
  return {
    id: ulid(),
    conversationId,
    snapshotId: ulid(),
    catalogVersionId: ulid(),
    headline: 'Judul',
    body: 'Isi',
    stats: {
      outletCount: 0,
      mainSize: '1"',
      branchCount: 0,
      fixtureConnectionSize: '1/2"',
      productCount: 0,
    },
    systemLines: [],
    products: [],
    bom: [],
    assumptions: [],
    overallProvenance: 'ASSUMED',
    createdAt: '2026-10-05T00:00:00.000Z',
  };
}

beforeEach(() => mysql.clear());
afterAll(() => mysql.close());

describe('MysqlRecommendationRepository — asal prosa (OQ-44)', () => {
  it.each<ProseSource>(['llm', 'llm_retry', 'template'])(
    'menyimpan prose_source = %s apa adanya',
    async (proseSource) => {
      const recommendation = recommendationFor(await seedConversation());

      await repository.save(recommendation, [], { proseSource });

      const [row] = await mysql.db
        .select({ proseSource: recommendations.proseSource })
        .from(recommendations)
        .where(eq(recommendations.id, recommendation.id));
      expect(row?.proseSource).toBe(proseSource);
    },
  );

  it('kolom audit tidak bocor ke Recommendation yang dibaca kembali', async () => {
    const recommendation = recommendationFor(await seedConversation());
    await repository.save(recommendation, [], { proseSource: 'llm_retry' });

    const found = await repository.findById(recommendation.id);

    expect(found).not.toBeNull();
    expect(found).not.toHaveProperty('proseSource');
    expect(found?.headline).toBe('Judul');
  });
});
