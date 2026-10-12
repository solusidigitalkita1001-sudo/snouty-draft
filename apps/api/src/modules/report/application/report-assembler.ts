/**
 * Merakit `ReportPayload` dari `Recommendation` + `CalculationTrace`.
 * docs/REPORT.md §1, §2. **Fungsi murni, dan TANPA satu pun panggilan LLM.**
 *
 * Itu bukan optimasi, itu prinsipnya: laporan yang sama dirakit dua kali harus identik,
 * dan laporan tahun ini harus terbaca sama tahun depan. Memanggil model ulang saat
 * mencetak akan membuat dua unduhan dokumen yang sama berbeda isinya — dan dokumen yang
 * dibawa ke distributor tidak boleh begitu.
 *
 * Kolom STATUS di tabel sistem mengikuti aturan provenance yang sama seperti di layar.
 * Karena seluruh aturan teknik masih `REQUIRES_DOMAIN_VALIDATION` (OQ-06), laporan hari
 * ini menampilkan ASUMSI di keempat baris — sementara mockup menampilkan tiga
 * TERVERIFIKASI. Perbedaan itu benar, dan bukan sesuatu yang boleh "diperbaiki" dengan
 * memaksakan VERIFIED.
 */

import { outdatedRules, rulesetStamp, stepFormula } from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type AnySchematic,
  type Locale,
  type Recommendation,
  type RequirementFieldPath,
  type RequirementState,
} from '@snouty/shared-types';
import {
  requirementFieldLabel,
  requirementValueLabel,
} from '../../context/domain/requirement-labels.js';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import type {
  ReportBasisRow,
  ReportPendingItem,
  ReportIdentity,
  ReportPayload,
  ReportPricing,
  ReportRequirementRow,
} from '../domain/report.types.js';

export interface AssembleReportInput {
  readonly reportNumber: string;
  readonly recommendation: Recommendation;
  readonly traces: readonly TraceToSave[];
  readonly state: RequirementState;
  readonly identity: ReportIdentity;
  readonly catalogVersionLabel: string;
  /** Harga hanya dirender bila `PRICING_ENABLED` (OQ-03, baku nonaktif). */
  readonly pricing: { readonly enabled: boolean; readonly taxRatePercent: number };
  /**
   * Bahasa percakapan (P15-05). Menentukan label baris kebutuhan dan ikut dibekukan ke
   * payload, supaya halaman cetak memakai bahasa yang sama kapan pun dicetak ulang.
   */
  readonly locale?: Locale;
  /**
   * Nama katalog produk terpilih (`productId` → nama), dicari service dari versi katalog
   * rekomendasinya. Produk tanpa nama di sini tidak didaftar — nama tidak pernah dikarang.
   */
  readonly productNames?: ReadonlyMap<string, string>;
  /** Skema instalasi dari jalur yang sama dengan layar skema; `null` bila tidak bisa dibentuk. */
  readonly schematic?: AnySchematic | null;
}

export function assembleReportPayload(input: AssembleReportInput): ReportPayload {
  const locale = input.locale ?? DEFAULT_LOCALE;
  return {
    reportNumber: input.reportNumber,
    identity: input.identity,
    headline: input.recommendation.headline,
    body: input.recommendation.body,
    requirements: requirementRows(input.state, locale),
    systemLines: input.recommendation.systemLines,
    assumptions: input.recommendation.assumptions,
    bom: input.recommendation.bom,
    basis: basisRows(input.traces, locale),
    pricing: pricingFrom(input.recommendation, input.pricing),
    catalogVersionLabel: input.catalogVersionLabel,
    overallProvenance: input.recommendation.overallProvenance,
    locale,
    // Versi aturan dari trace rekomendasi ini — dicetak di laporan (temuan laporan 0002).
    ruleset: {
      stamp: rulesetStamp(input.traces),
      outdated: outdatedRules(input.traces).length > 0,
    },
    pendingItems: pendingItems(input.recommendation, input.productNames ?? new Map()),
    ...(input.schematic ? { schematic: input.schematic } : {}),
  };
}

/**
 * Produk terpilih yang belum punya baris jumlah — tetap didaftar supaya pembaca tahu barang apa
 * yang dibeli; jumlahnya menyusul setelah panjang jalur atau ukuran rumah diketahui. Satu baris
 * per produk; produk yang ketersediaannya tidak diketahui tidak ikut.
 */
function pendingItems(
  recommendation: Recommendation,
  names: ReadonlyMap<string, string>,
): readonly ReportPendingItem[] {
  const counted = new Set(recommendation.bom.map((item) => item.productId));
  const seen = new Set<string>();
  const rows: ReportPendingItem[] = [];
  for (const product of recommendation.products) {
    if (product.matchState === 'INFORMATION_UNAVAILABLE') continue;
    if (counted.has(product.productId) || seen.has(product.productId)) continue;
    const name = names.get(product.productId);
    if (name === undefined) continue;
    seen.add(product.productId);
    rows.push({
      productId: product.productId,
      name,
      size: product.size,
      kind: product.role === 'fitting' ? 'fitting' : 'pipe',
    });
  }
  return rows;
}

/**
 * Blok "KEBUTUHAN YANG TERCATAT" halaman 1. Label dan nilainya memakai redaksi yang sama
 * dengan kartu kebutuhan (`requirement-labels.ts`), dalam bahasa percakapan.
 */
function requirementRows(state: RequirementState, locale: Locale): readonly ReportRequirementRow[] {
  const rows: ReportRequirementRow[] = [];
  const add = (
    path: RequirementFieldPath,
    field: { value: unknown; provenance: ReportRequirementRow['provenance'] },
  ): void => {
    // Nilai yang belum ada tidak dirender sebagai baris kosong — ia tidak dirender
    // sama sekali, supaya laporan tidak memuat baris tanpa informasi.
    if (field.value === null) return;
    rows.push({
      label: requirementFieldLabel(path, locale),
      value: requirementValueLabel(path, field.value, locale),
      provenance: field.provenance,
    });
  };

  add('building.type', state.building.type);
  add('building.floors', state.building.floors);
  add('water.source', state.water.source);
  add('water.installationType', state.water.installationType);
  add('fixtures.bathrooms', state.fixtures.bathrooms);
  add('fixtures.basins', state.fixtures.basins);
  add('fixtures.kitchens', state.fixtures.kitchens);
  return rows;
}

/**
 * Blok "DASAR PERHITUNGAN" halaman 2 — dirakit dari trace, bukan dari prosa LLM
 * (invarian T-1). Satu baris per aturan, urut sesuai eksekusi.
 */
/** Satu baris per trace; rumus singkatnya dibangun dari masukan/keluaran trace itu sendiri. */
function basisRows(traces: readonly TraceToSave[], locale: Locale): readonly ReportBasisRow[] {
  return traces.map((trace) => {
    const formula = stepFormula(trace.ruleId, trace.inputs, trace.output, locale);
    return {
      ruleId: trace.ruleId,
      explanation: trace.explanation,
      ...(formula !== null ? { formula } : {}),
    };
  });
}

/**
 * Total harga. Saat `PRICING_ENABLED` nonaktif, seluruh angkanya nol dan halaman tidak
 * merender bloknya — bukan menampilkan Rp 0, yang akan terbaca sebagai "gratis".
 */
function pricingFrom(
  recommendation: Recommendation,
  config: { enabled: boolean; taxRatePercent: number },
): ReportPricing {
  if (!config.enabled) {
    return {
      enabled: false,
      taxRatePercent: config.taxRatePercent,
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    };
  }

  const subtotal = recommendation.bom.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
  const taxAmount = Math.round((subtotal * config.taxRatePercent) / 100);
  return {
    enabled: true,
    taxRatePercent: config.taxRatePercent,
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}
