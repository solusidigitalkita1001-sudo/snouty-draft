/**
 * P12-01a — agregasi, dan terutama **ambang k-anonimitas**: kelompok dengan < 5 kejadian
 * tidak pernah dipublikasikan. docs/MARKET_INTELLIGENCE.md §5.
 *
 * Juga menguji hal yang mudah terlewat: bentuk `MarketEvent` tidak punya jalur untuk data
 * pribadi. Itu diuji lewat bentuk tipenya, karena yang tidak bisa ditulis tidak bisa bocor.
 */
import { describe, expect, it } from 'vitest';
import {
  consultationFunnel,
  drainageDemand,
  K_ANONYMITY_THRESHOLD,
  productInterestTrend,
  projectPatterns,
  regionalDemand,
  scopeSignal,
} from './aggregate.js';
import { dayOf, productInterestKey, type MarketEvent } from './market-event.js';

function event(over: Partial<MarketEvent> = {}): MarketEvent {
  return {
    id: '01JBEVENT0000000000000000A',
    source: 'chat',
    occurredOn: '2026-10-02',
    region: 'Surabaya',
    buildingType: 'residential',
    projectScale: 'sedang',
    installationType: 'air_bersih',
    outletCount: 8,
    floors: 2,
    productInterest: [productInterestKey('PVC AW', '1"')],
    quotationIntent: false,
    reachedSolution: true,
    routedToTechnical: false,
    ...over,
  };
}

const many = (count: number, over: Partial<MarketEvent> = {}): MarketEvent[] =>
  Array.from({ length: count }, (_, i) => event({ id: `e${i}`, ...over }));

describe('ambang k-anonimitas', () => {
  it('menahan kelompok dengan kejadian kurang dari lima', () => {
    const result = regionalDemand(many(4));
    expect(result.buckets).toEqual([]);
    expect(result.suppressedGroups).toBe(1);
    expect(result.suppressedEvents).toBe(4);
  });

  it('menerbitkan kelompok tepat di ambang', () => {
    const result = regionalDemand(many(K_ANONYMITY_THRESHOLD));
    expect(result.buckets).toEqual([{ key: 'Surabaya|2026-10', count: 5 }]);
    expect(result.suppressedGroups).toBe(0);
  });

  it('menahan kota kecil sambil menerbitkan kota besar', () => {
    const events = [...many(8), ...many(2, { region: 'Kota Kecil' })];
    const result = regionalDemand(events);
    expect(result.buckets.map((b) => b.key)).toEqual(['Surabaya|2026-10']);
    expect(result.suppressedGroups).toBe(1);
  });

  it('melaporkan yang ditahan, tidak membuangnya diam-diam', () => {
    // Pembaca dashboard harus tahu ada data yang tidak tampil, bukan menyimpulkan nol.
    const result = regionalDemand([
      ...many(6),
      ...many(3, { region: 'A' }),
      ...many(2, { region: 'B' }),
    ]);
    expect(result.suppressedGroups).toBe(2);
    expect(result.suppressedEvents).toBe(5);
  });

  it('wilayah yang tidak diketahui tidak membentuk kelompok', () => {
    const result = regionalDemand(many(9, { region: null }));
    expect(result.buckets).toEqual([]);
    expect(result.suppressedGroups).toBe(0);
  });
});

describe('agregat', () => {
  it('permintaan regional dikelompokkan per wilayah × bulan', () => {
    const result = regionalDemand([...many(5), ...many(6, { occurredOn: '2026-11-03' })]);
    expect(result.buckets.map((b) => b.key).sort()).toEqual([
      'Surabaya|2026-10',
      'Surabaya|2026-11',
    ]);
  });

  it('minat produk menghitung tiap kunci, bukan tiap event', () => {
    const events = many(5, {
      productInterest: [productInterestKey('PVC AW', '1"'), productInterestKey('PVC AW', '3/4"')],
    });
    const result = productInterestTrend(events);
    expect(result.buckets).toHaveLength(2);
    for (const bucket of result.buckets) expect(bucket.count).toBe(5);
  });

  it('pola proyek menggabungkan tipe bangunan, skala, dan wilayah', () => {
    const result = projectPatterns(many(5));
    expect(result.buckets[0]!.key).toBe('residential|sedang|Surabaya');
  });

  it('sinyal cakupan tidak dikenai ambang — ia rasio seluruh himpunan', () => {
    // Rasio atas semua kejadian tidak bisa menunjuk satu orang, jadi menahannya hanya
    // menyembunyikan sinyal yang justru dibutuhkan untuk tahu cakupan terlalu sempit.
    const result = scopeSignal([...many(1, { routedToTechnical: true }), ...many(3)]);
    expect(result.total).toBe(4);
    expect(result.routedToTechnical).toBe(1);
    expect(result.ratio).toBeCloseTo(0.25);
  });

  it('himpunan kosong tidak menghasilkan pembagian nol', () => {
    expect(scopeSignal([]).ratio).toBe(0);
  });

  it('permintaan pembuangan menghitung "pembuangan" dan "keduanya"', () => {
    const events = [
      ...many(2, { installationType: 'pembuangan' }),
      ...many(3, { installationType: 'keduanya' }),
      ...many(4, { installationType: 'air_bersih' }),
    ];
    expect(drainageDemand(events)).toBe(5);
  });

  it('corong konsultasi menghitung tiap tahap', () => {
    const result = consultationFunnel([
      ...many(3, { reachedSolution: true, quotationIntent: true }),
      ...many(2, { reachedSolution: false, routedToTechnical: true }),
    ]);
    expect(result).toEqual({
      started: 5,
      reachedSolution: 3,
      routedToTechnical: 2,
      requestedQuotation: 3,
    });
  });
});

describe('bentuk event tidak punya jalur untuk data pribadi', () => {
  it('tidak memuat pengenal pengguna, percakapan, maupun email', () => {
    const keys = Object.keys(event());
    for (const forbidden of [
      'userId',
      'guestSessionId',
      'conversationId',
      'emailId',
      'name',
      'email',
      'phone',
      'text',
      'message',
    ]) {
      expect(keys, `field terlarang ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('occurredOn dibulatkan ke hari, bukan detik', () => {
    expect(dayOf('2026-10-02T14:37:21.123Z')).toBe('2026-10-02');
    expect(event().occurredOn).toHaveLength(10);
  });

  it('minat produk memakai keluarga+ukuran, bukan SKU', () => {
    expect(productInterestKey('PVC AW', '1"')).toBe('PVC AW|1"');
  });
});
