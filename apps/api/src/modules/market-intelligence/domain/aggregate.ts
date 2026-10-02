/**
 * Agregasi market intelligence. docs/MARKET_INTELLIGENCE.md §5. **Fungsi murni.**
 *
 * **Ambang k-anonimitas** adalah inti berkas ini: kelompok dengan kurang dari lima
 * kejadian tidak dipublikasikan. Di kota kecil dengan satu konsultasi bulan itu,
 * "Rumah 3 lantai di <kota>" praktis menunjuk satu orang — dan ambang inilah yang
 * mencegahnya. Ia diterapkan di lapisan agregasi, bukan di dashboard: agregat yang sudah
 * tersimpan tanpa ambang berarti datanya sudah bocor ke tabel sebelum ada yang melihatnya.
 */

import type { MarketEvent } from './market-event.js';

/** Kelompok dengan kejadian lebih sedikit dari ini tidak pernah dipublikasikan. */
export const K_ANONYMITY_THRESHOLD = 5;

export interface AggregateBucket {
  readonly key: string;
  readonly count: number;
}

export interface AggregateResult {
  readonly buckets: readonly AggregateBucket[];
  /**
   * Jumlah kelompok yang ditahan ambang, dan total kejadian di dalamnya. Dilaporkan —
   * bukan dibuang diam-diam — supaya pembaca dashboard tahu ada data yang tidak tampil
   * dan tidak menyimpulkan permintaan nol.
   */
  readonly suppressedGroups: number;
  readonly suppressedEvents: number;
}

function tally(
  events: readonly MarketEvent[],
  keyOf: (event: MarketEvent) => string | null,
): AggregateResult {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = keyOf(event);
    if (key === null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets: AggregateBucket[] = [];
  let suppressedGroups = 0;
  let suppressedEvents = 0;

  for (const [key, count] of [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )) {
    if (count < K_ANONYMITY_THRESHOLD) {
      suppressedGroups += 1;
      suppressedEvents += count;
      continue;
    }
    buckets.push({ key, count });
  }

  return { buckets, suppressedGroups, suppressedEvents };
}

/** Permintaan regional: wilayah × bulan. */
export function regionalDemand(events: readonly MarketEvent[]): AggregateResult {
  return tally(events, (event) =>
    event.region === null ? null : `${event.region}|${event.occurredOn.slice(0, 7)}`,
  );
}

/** Tren minat produk: keluarga+ukuran × bulan. Satu event bisa menyumbang beberapa kunci. */
export function productInterestTrend(events: readonly MarketEvent[]): AggregateResult {
  const expanded: MarketEvent[] = [];
  for (const event of events) {
    for (const interest of event.productInterest) {
      expanded.push({ ...event, productInterest: [interest] });
    }
  }
  return tally(expanded, (event) =>
    event.productInterest[0] === undefined
      ? null
      : `${event.productInterest[0]}|${event.occurredOn.slice(0, 7)}`,
  );
}

/** Pola tipe proyek: tipe bangunan × skala × wilayah. */
export function projectPatterns(events: readonly MarketEvent[]): AggregateResult {
  return tally(events, (event) =>
    event.buildingType === null
      ? null
      : `${event.buildingType}|${event.projectScale ?? 'tidak_diketahui'}|${event.region ?? 'tidak_diketahui'}`,
  );
}

export interface ScopeSignal {
  readonly total: number;
  readonly routedToTechnical: number;
  /** Rasio 0–1. Tinggi berarti cakupan rekomendasi terlalu sempit. */
  readonly ratio: number;
}

/**
 * Sinyal cakupan. **Tidak** dikenai ambang k-anonimitas: ia rasio atas seluruh himpunan,
 * bukan kelompok kecil yang bisa menunjuk orang.
 */
export function scopeSignal(events: readonly MarketEvent[]): ScopeSignal {
  const routed = events.filter((event) => event.routedToTechnical).length;
  return {
    total: events.length,
    routedToTechnical: routed,
    ratio: events.length === 0 ? 0 : routed / events.length,
  };
}

/** Permintaan pembuangan — bukti kelayakan fitur, bukan dugaan. */
export function drainageDemand(events: readonly MarketEvent[]): number {
  return events.filter(
    (event) => event.installationType === 'pembuangan' || event.installationType === 'keduanya',
  ).length;
}

export interface ConsultationFunnel {
  readonly started: number;
  readonly reachedSolution: number;
  readonly routedToTechnical: number;
  readonly requestedQuotation: number;
}

/** Corong konsultasi: di mana pengguna berhenti. */
export function consultationFunnel(events: readonly MarketEvent[]): ConsultationFunnel {
  return {
    started: events.length,
    reachedSolution: events.filter((event) => event.reachedSolution).length,
    routedToTechnical: events.filter((event) => event.routedToTechnical).length,
    requestedQuotation: events.filter((event) => event.quotationIntent).length,
  };
}
