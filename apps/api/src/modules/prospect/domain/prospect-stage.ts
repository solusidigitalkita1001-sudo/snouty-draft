/**
 * Tahap 5A dan prioritas prospek (P26-03, docs/PROSPECT_5A.md §2–§3). Fungsi murni: kejadian yang
 * sudah dibaca dari basis data masuk, tahap dan prioritas keluar. Tidak ada model yang memberi skor —
 * aturan di sini yang menentukan, dan angkanya dikalibrasi ulang dari status menang/kalah (§5).
 *
 * Modul ini tidak boleh diimpor rekomendasi, engineering, atau context (pagar lint): skor prospek
 * tidak pernah memengaruhi rekomendasi.
 */
import type { FineIntent } from '../../understanding/domain/labels.js';

export const STAGES = ['aware', 'appeal', 'ask', 'act', 'advocate'] as const;
export type Stage = (typeof STAGES)[number];

export type ProjectScale = 'house' | 'building' | 'district';
export type Priority = 'hot' | 'warm' | 'cold';

/** Kejadian yang bermakna bagi tahap 5A, dari tabel yang sudah ada dan `prospect_signals`. */
export type ProspectEvent =
  | { readonly kind: 'account_created'; readonly at: Date }
  | { readonly kind: 'conversation_started'; readonly at: Date }
  /** Pesan terakhir di percakapan: kebaruan saja, tidak menggeser tahap. */
  | { readonly kind: 'activity'; readonly at: Date }
  | { readonly kind: 'intent'; readonly label: string; readonly at: Date }
  | { readonly kind: 'product_view'; readonly at: Date }
  | { readonly kind: 'pin'; readonly at: Date }
  | { readonly kind: 'analysis'; readonly at: Date }
  | { readonly kind: 'technical_handoff'; readonly at: Date }
  | { readonly kind: 'report_created'; readonly at: Date }
  | { readonly kind: 'report_download'; readonly at: Date }
  | { readonly kind: 'sales_request'; readonly at: Date }
  | { readonly kind: 'share_created'; readonly at: Date }
  | { readonly kind: 'share_visit'; readonly at: Date };

/**
 * Tahap tiap label pemahaman. `null` = tidak menggeser tahap: basa-basi, keluhan, dan lanjutan yang
 * maknanya hanya relatif terhadap giliran sebelumnya. `Record` atas seluruh `FineIntent`: label baru
 * gagal typecheck sampai tahapnya diputuskan.
 */
const INTENT_STAGE: Readonly<Record<FineIntent, Stage | null>> = {
  greeting: null,
  thanks: null,
  ack: null,
  bye: null,
  complaint: null,
  out_of_scope: null,
  // Bertanya apa yang bisa dikerjakan di sini belum menunjukkan minat pada produknya.
  capability_question: null,
  company_question: 'aware',
  knowledge_question: 'aware',
  // Tertarik pada produk Pralon — termasuk yang membandingkannya dengan pesaing.
  competitor_question: 'appeal',
  product_concept: 'appeal',
  product_comparison: 'appeal',
  product_spec: 'appeal',
  product_range: 'appeal',
  use_question: 'appeal',
  // Menimbang pembelian untuk kebutuhan nyata.
  price_question: 'ask',
  advice_request: 'ask',
  requirement_building: 'ask',
  requirement_irrigation: 'ask',
  requirement_technical: 'ask',
  requirement_mutation: 'ask',
  clarification_answer: 'ask',
  explanation_request: 'ask',
  system_layout_question: 'ask',
  follow_up_continue: null,
  follow_up_more: null,
  follow_up_brief: null,
  follow_up_reference: null,
  follow_up_choice: null,
  follow_up_reformat: null,
};

/** Validasi tim teknis masih menimbang (Ask); laporan dan minta dihubungi adalah tindakan (Act). */
const EVENT_STAGE: Readonly<Record<Exclude<ProspectEvent['kind'], 'intent'>, Stage | null>> = {
  account_created: 'aware',
  conversation_started: 'aware',
  activity: null,
  product_view: 'appeal',
  pin: 'appeal',
  analysis: 'ask',
  technical_handoff: 'ask',
  report_created: 'act',
  report_download: 'act',
  sales_request: 'act',
  share_created: 'advocate',
  share_visit: 'advocate',
};

export function stageOf(event: ProspectEvent): Stage | null {
  if (event.kind !== 'intent') return EVENT_STAGE[event.kind];
  return (INTENT_STAGE as Readonly<Record<string, Stage | null>>)[event.label] ?? null;
}

/**
 * Bobot tahap (§3). Advocate di bawah Act: ia sinyal loyalitas, bukan pembelian yang sedang berjalan —
 * itu sebabnya prioritas memakai bobot TERBESAR yang pernah dicapai, bukan bobot tahap terakhir.
 */
export const STAGE_WEIGHT: Readonly<Record<Stage, number>> = {
  aware: 1,
  appeal: 2,
  ask: 4,
  act: 6,
  advocate: 5,
};

export const SCALE_WEIGHT: Readonly<Record<ProjectScale, number>> = {
  house: 1,
  building: 2,
  district: 4,
};

/** Setengah umur kebaruan: prospek yang diam dua minggu bernilai separuh. */
export const HALF_LIFE_DAYS = 14;
export const HOT_AT = 12;
export const WARM_AT = 4;

const DISTRICT_CASES = new Set([
  'residential_cluster',
  'water_supply_network',
  'sewerage',
  'stormwater',
  'irrigation',
]);
const BUILDING_CASES = new Set([
  'multistorey_building_water',
  'pump_transfer',
  'gravity_drainage',
  'culvert',
  'fish_pond',
]);
const BUILDING_TYPES = new Set([
  'boarding_house',
  'light_commercial',
  'public_building',
  'place_of_worship',
  'industrial',
]);

/**
 * Skala satu proyek dari jenis kasus atau jenis bangunannya. Tidak diketahui = rumah: skala terkecil,
 * supaya prospek tidak pernah tampak lebih besar daripada yang dikatakan penggunanya.
 */
export function projectScaleOf(project: {
  readonly useCase?: string | null;
  readonly buildingType?: string | null;
}): ProjectScale {
  if (project.useCase && DISTRICT_CASES.has(project.useCase)) return 'district';
  if (project.useCase && BUILDING_CASES.has(project.useCase)) return 'building';
  if (project.buildingType && BUILDING_TYPES.has(project.buildingType)) return 'building';
  return 'house';
}

export interface ProspectView {
  readonly stage: Stage;
  /** Kapan tahap tertinggi itu pertama kali dicapai. */
  readonly stageReachedAt: Date;
  readonly lastActivityAt: Date;
  readonly scale: ProjectScale;
  readonly score: number;
  readonly priority: Priority;
}

/**
 * Tahap tertinggi, skala proyek terbesar, dan prioritas pada saat `now`. `null` bila tidak ada satu
 * pun kejadian — akun tanpa jejak bukan prospek.
 */
export function assessProspect(
  events: readonly ProspectEvent[],
  scales: readonly ProjectScale[],
  now: Date,
): ProspectView | null {
  if (events.length === 0) return null;
  const order = (s: Stage) => STAGES.indexOf(s);
  let stage: Stage = 'aware';
  let stageReachedAt: Date | null = null;
  let weight = STAGE_WEIGHT.aware;
  let lastActivityAt = events[0]!.at;
  for (const event of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (event.at > lastActivityAt) lastActivityAt = event.at;
    const reached = stageOf(event);
    if (reached === null) continue;
    weight = Math.max(weight, STAGE_WEIGHT[reached]);
    if (stageReachedAt === null || order(reached) > order(stage)) {
      stage = reached;
      stageReachedAt = event.at;
    }
  }
  const scale = scales.reduce<ProjectScale>(
    (largest, s) => (SCALE_WEIGHT[s] > SCALE_WEIGHT[largest] ? s : largest),
    'house',
  );
  const idleDays = Math.max(0, (now.getTime() - lastActivityAt.getTime()) / 86_400_000);
  const score = weight * SCALE_WEIGHT[scale] * 0.5 ** (idleDays / HALF_LIFE_DAYS);
  return {
    stage,
    stageReachedAt: stageReachedAt ?? lastActivityAt,
    lastActivityAt,
    scale,
    score: Math.round(score * 100) / 100,
    priority: score >= HOT_AT ? 'hot' : score >= WARM_AT ? 'warm' : 'cold',
  };
}
