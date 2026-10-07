/**
 * Teks workspace solusi (layar 06) dan kartu produk (layar 07), apa adanya dari desain.
 *
 * Dua kalimat **tidak boleh diparafrase** karena membawa janji produk, bukan redaksi
 * (docs/DESIGN_IMPLEMENTATION.md §10): disclaimer panduan perencanaan dan label skema.
 */

import type { Locale } from '@snouty/shared-types';
import { pickCopy, type CopyShape } from '../copy';

export const SOLUTION_COPY = {
  summaryKicker: 'RINGKASAN',
  statsLabels: {
    outletCount: 'Titik air',
    mainSize: 'Jalur utama',
    branch: 'Cabang',
    fixture: 'Sambungan fixture',
    products: 'Produk Pralon',
  },
  /** Statistik solusi irigasi (OQ-47) — belum didesain; label mengikuti pola bangunan. */
  irrigationStats: {
    area: 'Luas lahan',
    flow: 'Debit rencana',
    pump: 'Pompa',
    pumpYes: 'Diperlukan',
    pumpNo: 'Gravitasi',
  },
  systemTitle: 'Rekomendasi Sistem',
  showTechnical: 'Tampilkan detail teknis',
  hideTechnical: 'Sembunyikan detail teknis',
  technicalKicker: 'DETAIL TEKNIS',
  bomTitle: 'Perkiraan Material',
  bomColumns: {
    item: 'Item',
    size: 'Ukuran',
    quantity: 'Jumlah',
    basis: 'DASAR PERHITUNGAN',
  },
  assumptionsTitle: 'Asumsi yang digunakan',
  fixAssumption: 'Perbaiki asumsi ini →',
  productsTitle: 'Produk Pralon yang sesuai',

  // Janji produk — jangan diparafrase.
  planningDisclaimer: 'PANDUAN PERENCANAAN — BUKAN SERTIFIKASI TEKNIS',
  schematicDisclaimer: 'SKEMATIK · BUKAN GAMBAR KERJA',
  /** Tab "Skema" di layar solusi: gambarnya hidup di halaman /schematic; tab ini pengantarnya. */
  schematicKicker: 'SKEMA',
  schematicLoading: 'Menyiapkan skema…',
  schematicUnavailable: 'Skema belum tersedia untuk konsultasi ini.',
  priceDisclaimer: 'Perkiraan perencanaan, bukan penawaran resmi.',

  /**
   * Bagian tetap jawaban teknis (Fase 14 §28) — BELUM DIDESAIN (OQ-50): dibangun minimal dengan
   * token yang sama; label di sini menunggu desain, bukan sumber kebenaran visual.
   */
  composition: {
    optionsTitle: 'Opsi ukuran yang dipertimbangkan',
    optionsHint:
      'Semua kandidat yang dihitung — bukan hanya yang dipilih — supaya tradeoff-nya terlihat.',
    optionRecommended: 'DIREKOMENDASIKAN',
    optionAlternative: 'ALTERNATIF',
    optionStatus: {
      ok: 'MEMENUHI',
      too_fast: 'TERLALU CEPAT',
      too_slow: 'TERLALU LAMBAT',
      high_loss: 'KERUGIAN TINGGI',
      too_small: 'KAPASITAS KURANG',
    },
    readinessTitle: 'Kesiapan hasil',
    readinessLabel: {
      ready: 'SIAP',
      partial: 'SEBAGIAN',
      missing_data: 'DATA KURANG',
    },
    readinessMissing: 'Masih kurang:',
    readinessImprovable: 'Lebih akurat bila ada:',
    knownTitle: 'Data yang diketahui',
    assumedTitle: 'Parameter yang diasumsikan',
    calculationsTitle: 'Perhitungan',
    missingTitle: 'Data yang masih dibutuhkan',
  },

  matchStateLabel: {
    VERIFIED_SELECTED: 'DIPAKAI DI SOLUSI INI',
    SIZE_NEEDS_VALIDATION: 'UKURAN PERLU DIKONFIRMASI',
    INFORMATION_UNAVAILABLE: 'DATA BELUM LENGKAP',
  },
} as const;

export const SOLUTION_COPY_EN: CopyShape<typeof SOLUTION_COPY> = {
  summaryKicker: 'SUMMARY',
  statsLabels: {
    outletCount: 'Outlets',
    mainSize: 'Main line',
    branch: 'Branches',
    fixture: 'Fixture connections',
    products: 'Pralon products',
  },
  irrigationStats: {
    area: 'Land area',
    flow: 'Design flow',
    pump: 'Pump',
    pumpYes: 'Required',
    pumpNo: 'Gravity',
  },
  systemTitle: 'System Recommendation',
  showTechnical: 'Show technical details',
  hideTechnical: 'Hide technical details',
  technicalKicker: 'TECHNICAL DETAILS',
  bomTitle: 'Estimated Materials',
  bomColumns: {
    item: 'Item',
    size: 'Size',
    quantity: 'Quantity',
    basis: 'CALCULATION BASIS',
  },
  assumptionsTitle: 'Assumptions used',
  fixAssumption: 'Fix this assumption →',
  productsTitle: 'Matching Pralon products',

  planningDisclaimer: 'PLANNING GUIDANCE — NOT A TECHNICAL CERTIFICATION',
  schematicDisclaimer: 'SCHEMATIC · NOT A WORKING DRAWING',
  schematicKicker: 'SCHEMATIC',
  schematicLoading: 'Preparing the schematic…',
  schematicUnavailable: 'A schematic is not available for this consultation yet.',
  priceDisclaimer: 'A planning estimate, not an official quotation.',

  composition: {
    optionsTitle: 'Size options considered',
    optionsHint:
      'All calculated candidates — not just the selected one — so the tradeoffs are visible.',
    optionRecommended: 'RECOMMENDED',
    optionAlternative: 'ALTERNATIVE',
    optionStatus: {
      ok: 'MEETS REQUIREMENTS',
      too_fast: 'TOO FAST',
      too_slow: 'TOO SLOW',
      high_loss: 'HIGH LOSS',
      too_small: 'INSUFFICIENT CAPACITY',
    },
    readinessTitle: 'Result readiness',
    readinessLabel: {
      ready: 'READY',
      partial: 'PARTIAL',
      missing_data: 'MISSING DATA',
    },
    readinessMissing: 'Still missing:',
    readinessImprovable: 'More accurate with:',
    knownTitle: 'Known data',
    assumedTitle: 'Assumed parameters',
    calculationsTitle: 'Calculations',
    missingTitle: 'Data still needed',
  },

  matchStateLabel: {
    VERIFIED_SELECTED: 'USED IN THIS SOLUTION',
    SIZE_NEEDS_VALIDATION: 'SIZE NEEDS CONFIRMATION',
    INFORMATION_UNAVAILABLE: 'DATA INCOMPLETE',
  },
};

export function solutionCopy(locale: Locale): CopyShape<typeof SOLUTION_COPY> {
  return pickCopy(locale, SOLUTION_COPY, SOLUTION_COPY_EN);
}
