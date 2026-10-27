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

import {
  assertBalanced,
  outdatedRules,
  rulesetStamp,
  stepFormula,
  stepQualifier,
} from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  skuLines,
  type AnySchematic,
  type Locale,
  type Recommendation,
  type RequirementFieldPath,
  type RequirementState,
} from '@snouty/shared-types';
import {
  requirementFieldLabel,
  hasPublicToilets,
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
  /** Tanggal berlaku versi katalog, bila diketahui. */
  readonly catalogDate?: string;
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
  // Pagar terakhir (laporan 0015): sebaran per lantai di kebutuhan harus sama dengan totalnya.
  for (const need of input.recommendation.needs ?? []) {
    if (need.perFloor) {
      assertBalanced(
        `${need.kind} per lantai`,
        need.count,
        need.perFloor.map((f) => f.count),
      );
    }
  }
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
    ...(input.catalogDate ? { catalogDate: input.catalogDate.slice(0, 10) } : {}),
    overallProvenance: input.recommendation.overallProvenance,
    locale,
    // Versi aturan dari trace rekomendasi ini — dicetak di laporan (temuan laporan 0002).
    ruleset: {
      stamp: rulesetStamp(input.traces),
      outdated: outdatedRules(input.traces).length > 0,
    },
    pendingItems: pendingItems(input.recommendation, input.productNames ?? new Map()),
    ...(input.schematic ? { schematic: input.schematic } : {}),
    // DD-01 (P17-09): BOQ, ringkasan bergambar, dan lampiran produk dari data yang sama dengan layar.
    // Varian alternatif tidak dicetak — tidak ikut dibekukan.
    products: input.recommendation.products.map(({ alternatives: _alternatives, ...product }) => {
      const name = product.name ?? input.productNames?.get(product.productId);
      return name !== undefined ? { ...product, name } : product;
    }),
    ...(input.recommendation.needs ? { needs: input.recommendation.needs } : {}),
    ...(input.recommendation.tankStand ? { tankStand: input.recommendation.tankStand } : {}),
    ...(input.recommendation.stats ? { outletCount: input.recommendation.stats.outletCount } : {}),
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
  // Daftar SKU yang sama dengan tab Produk dan material (TC-H-05). Nama dari produk terpilih;
  // rekomendasi lama tanpa nama memakai pencarian katalog. Tanpa nama → tidak dikarang.
  return skuLines(recommendation)
    .filter((line) => !line.counted)
    .flatMap((line) => {
      const name = line.name ?? names.get(line.productId);
      return name === undefined
        ? []
        : [
            {
              productId: line.productId,
              name,
              size: line.selections[0]!.size,
              kind: line.kind,
            },
          ];
    });
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
      value: requirementValueLabel(path, field.value, locale, {
        bathroomHasTap: hasPublicToilets(state.building.type.value),
      }),
      provenance: field.provenance,
    });
  };

  add('building.type', state.building.type);
  add('building.floors', state.building.floors);
  // Setiap masukan yang dipakai hitungan tampil dengan statusnya (review 0015): ukuran bangunan dan
  // tanah (halaman dihitung dari selisihnya), tinggi lantai bila disebut pengguna.
  add('building.dimensions', state.building.dimensions);
  add('building.floorHeightM', state.building.floorHeightM);
  add('water.source', state.water.source);
  add('water.installationType', state.water.installationType);
  if (state.water.replaceExisting) add('water.replaceExisting', state.water.replaceExisting);
  // Renovasi (P23-03): jenis pekerjaan dan data pipa lama ikut ke tabel masukan laporan.
  if (state.water.workType?.value) add('water.workType', state.water.workType);
  if (state.water.existingMainSize?.value)
    add('water.existingMainSize', state.water.existingMainSize);
  if (state.water.existingPipeMaterial?.value) {
    add('water.existingPipeMaterial', state.water.existingPipeMaterial);
  }
  if (state.water.existingOutlets && state.water.existingOutlets.value !== null) {
    add('water.existingOutlets', state.water.existingOutlets);
  }
  if (state.water.addedOutlets && state.water.addedOutlets.value !== null) {
    add('water.addedOutlets', state.water.addedOutlets);
  }
  if (state.water.replacementLengthM && state.water.replacementLengthM.value !== null) {
    add('water.replacementLengthM', state.water.replacementLengthM);
  }
  add('fixtures.bathrooms', state.fixtures.bathrooms);
  add('fixtures.basins', state.fixtures.basins);
  add('fixtures.kitchens', state.fixtures.kitchens);
  if (state.fixtures.wudhuTaps) add('fixtures.wudhuTaps', state.fixtures.wudhuTaps);
  if (state.fixtures.wudhuAreas) add('fixtures.wudhuAreas', state.fixtures.wudhuAreas);
  if (state.fixtures.urinals) add('fixtures.urinals', state.fixtures.urinals);
  return rows;
}

/**
 * Blok "DASAR PERHITUNGAN" halaman 2 — dirakit dari trace, bukan dari prosa LLM
 * (invarian T-1). Satu baris per aturan, urut sesuai eksekusi.
 */
/** Satu baris per trace; rumus singkatnya dibangun dari masukan/keluaran trace itu sendiri. */
function basisRows(traces: readonly TraceToSave[], locale: Locale): readonly ReportBasisRow[] {
  // Aturan yang berjalan lebih dari sekali (ENG-102 per ukuran cabang, ENG-602/604 untuk air kotor
  // dan air bekas) tampil dengan judul yang sama persis. Barisnya dibedakan oleh ukuran yang
  // dihasilkannya sendiri — hanya bila memang berulang, supaya yang tunggal tetap bersih.
  const runs = new Map<string, number>();
  for (const trace of traces) runs.set(trace.ruleId, (runs.get(trace.ruleId) ?? 0) + 1);
  return traces.map((trace) => {
    const formula = stepFormula(
      trace.ruleId,
      trace.inputs,
      trace.output,
      locale,
      Number(trace.ruleVersion),
    );
    const qualifier =
      (runs.get(trace.ruleId) ?? 0) > 1 ? stepQualifier(trace.ruleId, trace.output) : null;
    return {
      ruleId: trace.ruleId,
      explanation: trace.explanation,
      ...(formula !== null ? { formula } : {}),
      ...(qualifier !== null ? { qualifier } : {}),
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
