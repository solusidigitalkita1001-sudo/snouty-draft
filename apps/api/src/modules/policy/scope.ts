/**
 * Policy 1 (hanya Pralon) dan Policy 5 (scope routing). SPEC §5.
 * **Fungsi murni, tanpa I/O** — modul `policy` wajib leaf (docs/ARCHITECTURE.md §7).
 *
 * Keputusan kebijakan BUKAN error: menolak membandingkan merek adalah jawaban yang
 * benar (HTTP 200 + kartu kriteria), bukan kegagalan sistem — dan mood mascot-nya
 * pun berbeda (`focus`, bukan `fail`).
 */

import type { BuildingType, InstallationType, PolicyCode } from '@snouty/shared-types';

export type PolicyOutcome =
  /** Alur yang didukung penuh — lanjut ke rekomendasi. */
  | { readonly kind: 'supported' }
  /** Dijawab, tetapi dengan kartu kebijakan alih-alih rekomendasi. */
  | { readonly kind: 'policy'; readonly code: PolicyCode; readonly reasons: readonly string[] };

/**
 * Policy 1 — pertanyaan kompetitor.
 *
 * Yang boleh: mengakui pertanyaannya, menjelaskan kriteria pemilihan netral,
 * menyebut nama kompetitor sebagai konteks. Yang tidak boleh: merekomendasikan
 * produk kompetitor, kartu produk kompetitor, mengarahkan ke kompetitor,
 * membandingkan merek.
 *
 * Fungsi ini tidak menerima daftar produk dan tidak mengembalikan satu pun — itulah
 * bentuk yang membuat "tidak ada kartu produk kompetitor" mustahil dilanggar lewat
 * jalur ini.
 */
/**
 * Guna yang jelas-jelas di luar cakupan "air bersih bangunan" — irigasi, pertanian, tambak,
 * kolam, air panas/uap, industri proses — dikenali dari PESANNYA, sebelum ekstraksi: tidak ada
 * field kebutuhan yang mewakilinya, dan menanyakan "berapa kamar mandi?" kepada petani sawah
 * adalah jawaban yang salah (laporan pemilik 2026-10-06, "irigasi sawah 1 hektar").
 */
const OUT_OF_SCOPE_USE =
  /\b(tambak|peternakan|air panas|uap|boiler|air laut|kimia|gas|minyak|bahan bakar)\b/i;

/**
 * Muara jalur irigasi (OQ-47): data lengkap → diteruskan ke tim teknis untuk dihitung. Bukan
 * penolakan — kebutuhannya dicatat rapi; yang belum ada hanya aturan sizing otomatisnya.
 */
export function irrigationHandoffPolicy(): PolicyOutcome {
  return {
    kind: 'policy',
    code: 'TECHNICAL_VALIDATION_REQUIRED',
    reasons: [
      'Data irigasi Anda sudah lengkap dan tercatat.',
      'Ukuran pipa irigasi dihitung tim teknis Pralon dari debit, jarak, dan beda tinggi — daftar produk dan ukurannya akan dikirim setelah perhitungan.',
    ],
  };
}

/**
 * Muara kasus teknis umum yang kalkulatornya belum tersedia (Fase 14): data sudah terstruktur
 * dalam parameter universal, perhitungannya diteruskan ke tim teknis. Bukan penolakan.
 */
export function technicalHandoffPolicy(caseLabel: string): PolicyOutcome {
  return {
    kind: 'policy',
    code: 'TECHNICAL_VALIDATION_REQUIRED',
    reasons: [
      `Data ${caseLabel.toLowerCase()} Anda sudah lengkap dan tercatat dengan parameter teknisnya.`,
      'Kalkulator otomatis untuk kasus ini sedang disiapkan — perhitungan dilakukan tim teknis Pralon dari data ini, lalu daftar produk dan ukurannya dikirim ke Anda.',
    ],
  };
}

export function useCasePolicy(message: string): PolicyOutcome {
  if (!OUT_OF_SCOPE_USE.test(message)) return { kind: 'supported' };
  return {
    kind: 'policy',
    code: 'TECHNICAL_VALIDATION_REQUIRED',
    reasons: [
      'Kebutuhan ini di luar cakupan rekomendasi otomatis SNOUTY (air bersih untuk rumah tinggal dan bangunan komersial kecil).',
      'Irigasi, pertanian, dan jalur khusus lainnya memerlukan perhitungan tim teknis Pralon — kebutuhan Anda akan diteruskan.',
    ],
  };
}

export function competitorPolicy(): PolicyOutcome {
  return {
    kind: 'policy',
    code: 'COMPETITOR_COMPARISON_REFUSED',
    reasons: NEUTRAL_CRITERIA,
  };
}

/**
 * Kriteria pemilihan netral (layar 08). Tidak menyebut merek apa pun — netral
 * berarti netral, termasuk tidak memuji Pralon di tempat yang seharusnya objektif.
 */
export const NEUTRAL_CRITERIA: readonly string[] = [
  'Kesesuaian kelas tekanan dengan kebutuhan instalasi.',
  'Ketersediaan ukuran dan fitting yang sepadan.',
  'Kesesuaian standar yang berlaku untuk penggunaannya.',
  'Kemudahan pemasangan dan perawatan di lapangan.',
  'Dukungan dokumentasi teknis yang bisa diperiksa.',
];

export interface ScopeInput {
  readonly buildingType: BuildingType | null;
  readonly installationType: InstallationType | null;
  readonly floors: number | null;
}

/** Di atas ini bangunan dianggap besar dan butuh validasi teknis (SPEC §5 Policy 5). */
const LARGE_BUILDING_FLOORS = 4;

/**
 * Policy 5 — scope routing.
 *
 * Air bersih rumah tinggal / komersial kecil didukung penuh. Pembuangan diakui dan
 * kebutuhannya dicatat, tetapi belum didukung untuk rekomendasi penuh. Industri,
 * pabrik, dan bangunan besar selalu ke validasi teknis (layar 11).
 *
 * Urutannya penting: industri diperiksa lebih dulu karena ia menang atas apa pun
 * jenis instalasinya.
 */
export function scopePolicy(input: ScopeInput): PolicyOutcome {
  if (input.buildingType === 'industrial') {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: ['Instalasi industri memerlukan pemeriksaan tim teknis Pralon.'],
    };
  }

  if (input.floors !== null && input.floors > LARGE_BUILDING_FLOORS) {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [`Bangunan ${input.floors} lantai berada di luar cakupan rekomendasi otomatis.`],
    };
  }

  if (input.installationType === 'drainage' || input.installationType === 'both') {
    return {
      kind: 'policy',
      code: 'SCOPE_NOT_YET_SUPPORTED',
      reasons: [
        'Kebutuhan saluran pembuangan sudah dicatat.',
        'Rekomendasi penuh untuk pembuangan belum didukung; tim teknis Pralon dapat membantu.',
      ],
    };
  }

  return { kind: 'supported' };
}
