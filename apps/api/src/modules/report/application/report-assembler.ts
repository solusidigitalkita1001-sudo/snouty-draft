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

import type { Recommendation, RequirementState } from '@snouty/shared-types';
import type { TraceToSave } from '../../recommendation/domain/recommendation.repository.js';
import type {
  ReportBasisRow,
  ReportIdentity,
  ReportPayload,
  ReportPricing,
  ReportRequirementRow,
} from '../domain/report.types.js';

const BUILDING_LABEL: Readonly<Record<string, string>> = {
  residential: 'Rumah tinggal',
  boarding_house: 'Rumah kos',
  light_commercial: 'Komersial ringan',
  industrial: 'Industri',
};

const SOURCE_LABEL: Readonly<Record<string, string>> = {
  rooftop_tank: 'Toren atap',
  ground_tank: 'Toren bawah',
  pump: 'Pompa',
  municipal: 'PDAM',
};

const INSTALLATION_LABEL: Readonly<Record<string, string>> = {
  clean_water: 'Air bersih',
  drainage: 'Pembuangan',
  both: 'Air bersih + pembuangan',
};

export interface AssembleReportInput {
  readonly reportNumber: string;
  readonly recommendation: Recommendation;
  readonly traces: readonly TraceToSave[];
  readonly state: RequirementState;
  readonly identity: ReportIdentity;
  readonly catalogVersionLabel: string;
  /** Harga hanya dirender bila `PRICING_ENABLED` (OQ-03, baku nonaktif). */
  readonly pricing: { readonly enabled: boolean; readonly taxRatePercent: number };
}

export function assembleReportPayload(input: AssembleReportInput): ReportPayload {
  return {
    reportNumber: input.reportNumber,
    identity: input.identity,
    headline: input.recommendation.headline,
    body: input.recommendation.body,
    requirements: requirementRows(input.state),
    systemLines: input.recommendation.systemLines,
    assumptions: input.recommendation.assumptions,
    bom: input.recommendation.bom,
    basis: basisRows(input.traces),
    pricing: pricingFrom(input.recommendation, input.pricing),
    catalogVersionLabel: input.catalogVersionLabel,
    overallProvenance: input.recommendation.overallProvenance,
  };
}

/** Blok "KEBUTUHAN YANG TERCATAT" halaman 1. */
function requirementRows(state: RequirementState): readonly ReportRequirementRow[] {
  const rows: ReportRequirementRow[] = [];
  const add = (
    label: string,
    field: { value: unknown; provenance: ReportRequirementRow['provenance'] },
    format: (v: unknown) => string,
  ): void => {
    // Nilai yang belum ada tidak dirender sebagai baris kosong — ia tidak dirender
    // sama sekali, supaya laporan tidak memuat baris tanpa informasi.
    if (field.value === null) return;
    rows.push({ label, value: format(field.value), provenance: field.provenance });
  };

  add('Tipe bangunan', state.building.type, (v) => BUILDING_LABEL[String(v)] ?? String(v));
  add('Jumlah lantai', state.building.floors, (v) => `${String(v)} lantai`);
  add('Sumber air', state.water.source, (v) => SOURCE_LABEL[String(v)] ?? String(v));
  add(
    'Jenis instalasi',
    state.water.installationType,
    (v) => INSTALLATION_LABEL[String(v)] ?? String(v),
  );
  add('Kamar mandi', state.fixtures.bathrooms, (v) => `${String(v)} titik`);
  add('Wastafel', state.fixtures.basins, (v) => `${String(v)} titik`);
  add('Dapur', state.fixtures.kitchens, (v) => `${String(v)} titik`);
  return rows;
}

/**
 * Blok "DASAR PERHITUNGAN" halaman 2 — dirakit dari trace, bukan dari prosa LLM
 * (invarian T-1). Satu baris per aturan, urut sesuai eksekusi.
 */
function basisRows(traces: readonly TraceToSave[]): readonly ReportBasisRow[] {
  return traces.map((trace) => ({ ruleId: trace.ruleId, explanation: trace.explanation }));
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
