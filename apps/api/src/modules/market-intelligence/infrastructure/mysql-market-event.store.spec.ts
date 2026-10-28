/**
 * P26-07 — penulis event pasar di MySQL: satu event per konsultasi, fakta dibaca dari snapshot
 * terakhir, niat penawaran dari label pesan, agregat dashboard dengan ambang k-anonimitas.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import {
  conversations,
  messages,
  requirementSnapshots,
} from '../../../infrastructure/mysql/schema/conversation.js';
import { marketEvents } from '../../../infrastructure/mysql/schema/intelligence.js';
import { MarketEventService } from '../application/market-event.service.js';
import { GeoIpLookup } from './geoip.js';
import { MysqlMarketEventStore } from './mysql-market-event.store.js';

let fixture: TestDatabase;
let service: MarketEventService;
const regions = {
  placeOf: async (ip: string | undefined) =>
    ip
      ? { province: 'Jawa Barat', city: 'Bandung', lat: -6.9, lng: 107.6 }
      : { province: null, city: null, lat: null, lng: null },
};

beforeAll(async () => {
  fixture = await createTestDatabase('market_events_writer');
});
afterAll(async () => {
  await fixture.close();
});

async function consultation(label: string, priceQuestion: boolean): Promise<string> {
  const id = testId(label);
  await fixture.db
    .insert(conversations)
    .values({ id, ownerKind: 'guest', ownerId: testId('GUESTMKT'), language: 'id' });
  await fixture.db.insert(requirementSnapshots).values({
    id: testId(`S${label}`),
    conversationId: id,
    version: 1,
    trigger: 'extraction',
    state: {
      building: { type: { value: 'residential' }, floors: { value: 2 } },
      water: { installationType: { value: 'clean_water' } },
    },
  });
  if (priceQuestion) {
    await fixture.db.insert(messages).values({
      id: testId(`M${label}`),
      conversationId: id,
      role: 'user',
      text: 'harganya berapa?',
      cards: [],
      intent: 'price_question',
    });
  }
  return id;
}

beforeEach(async () => {
  await fixture.clear();
  service = new MarketEventService(new MysqlMarketEventStore({ db: fixture.db }), regions);
});

describe('penulis event pasar (P26-07)', () => {
  it('satu event per konsultasi, tanpa id percakapan, dengan provinsi dan niat penawaran', async () => {
    const id = await consultation('MKTCONV1', true);
    await service.record(id, 'solution', '36.66.0.1');
    await service.record(id, 'technical', '36.66.0.1');

    const rows = await fixture.db.select().from(marketEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'chat',
      region: 'Jawa Barat',
      buildingType: 'residential',
      projectScale: 'kecil',
      installationType: 'air_bersih',
      floors: 2,
      quotationIntent: true,
      reachedSolution: true,
      routedToTechnical: false,
    });
    expect(JSON.stringify(rows[0])).not.toContain(id);
  });

  it('agregat: kelompok di bawah 5 ditahan, corong dan sinyal cakupan tetap dihitung', async () => {
    for (let i = 0; i < 6; i++) {
      const id = await consultation(`MKTC${i}`, i === 0);
      await service.record(id, i < 5 ? 'solution' : 'technical', '1.1.1.1');
    }
    const result = await service.dashboard(90);
    expect(result.total).toBe(6);
    expect(result.regional.buckets).toHaveLength(1);
    expect(result.regional.buckets[0]?.count).toBe(6);
    expect(result.funnel).toEqual({
      started: 6,
      reachedSolution: 5,
      routedToTechnical: 1,
      requestedQuotation: 1,
    });
    expect(result.scope.routedToTechnical).toBe(1);
  });

  it('percakapan yang tidak ada tidak melahirkan event, dan tidak menggagalkan apa pun', async () => {
    await expect(
      service.record(testId('TIDAKADA'), 'solution', undefined),
    ).resolves.toBeUndefined();
    expect(await fixture.db.select().from(marketEvents)).toHaveLength(0);
  });

  /**
   * P31-89 — kasus dengan nama terpanjang. Bila pengguna tidak menyebut jenis bangunan, yang
   * tercatat adalah id kasusnya, dan `multistorey_building_water` (26 huruf) ditolak kolom
   * varchar(24) di produksi: barisnya hilang dan galatnya ditelan sebagai peringatan.
   */
  it('kasus dengan nama terpanjang tetap tercatat', async () => {
    const id = testId('MKTLONG');
    await fixture.db
      .insert(conversations)
      .values({ id, ownerKind: 'guest', ownerId: testId('GUESTLONG'), language: 'id' });
    await fixture.db.insert(requirementSnapshots).values({
      id: testId('SMKTLONG'),
      conversationId: id,
      version: 1,
      trigger: 'extraction',
      state: { useCase: { kind: 'technical', caseId: 'multistorey_building_water' } },
    });

    await service.record(id, 'solution', '36.66.0.1');

    const rows = await fixture.db.select().from(marketEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.buildingType).toBe('multistorey_building_water');
  });
});

describe('GeoIpLookup tanpa berkas', () => {
  it('tanpa basis data: tanpa wilayah, bukan galat', async () => {
    expect((await new GeoIpLookup(undefined).placeOf('36.66.0.1')).province).toBeNull();
    expect((await new GeoIpLookup('/tidak/ada.mmdb').placeOf('36.66.0.1')).province).toBeNull();
  });
});
