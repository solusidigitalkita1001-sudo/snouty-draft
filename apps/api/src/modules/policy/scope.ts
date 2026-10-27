/**
 * Policy 1 (hanya Pralon) dan Policy 5 (scope routing). SPEC §5.
 * **Fungsi murni, tanpa I/O** — modul `policy` wajib leaf (docs/ARCHITECTURE.md §7).
 *
 * Keputusan kebijakan BUKAN error: menolak membandingkan merek adalah jawaban yang
 * benar (HTTP 200 + kartu kriteria), bukan kegagalan sistem — dan mood mascot-nya
 * pun berbeda (`focus`, bukan `fail`).
 */

import { HUNTER_TABLE_MAX_WSFU } from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type BuildingType,
  type InstallationType,
  type Locale,
  type PolicyCode,
} from '@snouty/shared-types';

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
// Tambak/kolam TIDAK lagi di sini: ia punya profil kasus + kalkulator sendiri (Fase 14, kasus
// `fish_pond`). Yang tersisa adalah fluida/kondisi yang bahannya butuh validasi (panas, kimia).
// "air proses" dan suhu tersurat ≥ 45° ikut: "jalur air proses pabrik, suhu 70 °C" adalah
// kondisi fluida yang butuh validasi bahan, apa pun jenis bangunannya (skenario uji §39).
/** Suhu fluida (°C) mulai dari mana bahan pipa air bersih biasa perlu divalidasi tim teknis. */
export const MAX_SUPPORTED_TEMPERATURE_C = 45;

/**
 * Isyarat yang sudah DIBACA dari pesan oleh pemanggil — kebijakan ini leaf dan tidak membaca
 * bahasa (P16-14): nama fluida di luar cakupan dikenali kosakata data, suhu oleh parser angka.
 */
export interface UseCaseSignals {
  readonly outOfScopeFluid: boolean;
  /** Suhu fluida yang tersurat, °C; `null` bila tidak disebut. */
  readonly temperatureC: number | null;
}

/**
 * Muara jalur irigasi (OQ-47): data lengkap → diteruskan ke tim teknis untuk dihitung. Bukan
 * penolakan — kebutuhannya dicatat rapi; yang belum ada hanya aturan sizing otomatisnya.
 */
export function irrigationHandoffPolicy(locale: Locale = DEFAULT_LOCALE): PolicyOutcome {
  if (locale === 'en') {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        'Your irrigation data is complete and recorded.',
        'The Pralon technical team calculates irrigation pipe sizes from flow rate, distance, and height difference — the product list and sizes will be sent after the calculation.',
      ],
    };
  }
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
export function technicalHandoffPolicy(
  caseLabel: string,
  locale: Locale = DEFAULT_LOCALE,
): PolicyOutcome {
  if (locale === 'en') {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        `Your ${caseLabel.toLowerCase()} data is complete and recorded with its technical parameters.`,
        'The automatic calculator for this case is being prepared — the Pralon technical team does the calculation from this data, then sends you the product list and sizes.',
      ],
    };
  }
  return {
    kind: 'policy',
    code: 'TECHNICAL_VALIDATION_REQUIRED',
    reasons: [
      `Data ${caseLabel.toLowerCase()} Anda sudah lengkap dan tercatat dengan parameter teknisnya.`,
      'Kalkulator otomatis untuk kasus ini sedang disiapkan — perhitungan dilakukan tim teknis Pralon dari data ini, lalu daftar produk dan ukurannya dikirim ke Anda.',
    ],
  };
}

export function useCasePolicy(
  signals: UseCaseSignals,
  locale: Locale = DEFAULT_LOCALE,
): PolicyOutcome {
  const hot = signals.temperatureC !== null && signals.temperatureC >= MAX_SUPPORTED_TEMPERATURE_C;
  if (!signals.outOfScopeFluid && !hot) return { kind: 'supported' };
  if (locale === 'en') {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        `Hot water above ${MAX_SUPPORTED_TEMPERATURE_C}°C, steam, or special fluids need a different pipe choice and their own calculation, so the Pralon technical team works them out.`,
        'Press “Send to the Pralon technical team” and your requirements go to them as they are recorded here.',
      ],
    };
  }
  return {
    kind: 'policy',
    code: 'TECHNICAL_VALIDATION_REQUIRED',
    reasons: [
      `Air panas di atas ${MAX_SUPPORTED_TEMPERATURE_C}°C, uap, atau cairan khusus perlu pilihan pipa dan perhitungan tersendiri, jadi yang menghitung tim teknis Pralon.`,
      'Tekan “Kirim ke tim teknis Pralon” supaya kebutuhan yang sudah tercatat di sini langsung diteruskan ke mereka.',
    ],
  };
}

export function competitorPolicy(locale: Locale = DEFAULT_LOCALE): PolicyOutcome {
  return {
    kind: 'policy',
    code: 'COMPETITOR_COMPARISON_REFUSED',
    reasons: neutralCriteria(locale).map((c) => c.detail),
  };
}

/**
 * Kriteria pemilihan netral (layar 08). Tidak menyebut merek apa pun — netral
 * berarti netral, termasuk tidak memuji Pralon di tempat yang seharusnya objektif.
 * Tiap butir punya labelnya sendiri (tes FAQ 2026-10-12: kelima label tertulis "Kriteria").
 */
export interface Criterion {
  readonly label: string;
  readonly detail: string;
}

export const NEUTRAL_CRITERIA: readonly Criterion[] = [
  { label: 'Kelas tekanan', detail: 'Kesesuaian kelas tekanan dengan kebutuhan instalasi.' },
  { label: 'Ukuran dan fitting', detail: 'Ketersediaan ukuran dan fitting yang sepadan.' },
  { label: 'Standar', detail: 'Kesesuaian standar yang berlaku untuk penggunaannya.' },
  { label: 'Pemasangan', detail: 'Kemudahan pemasangan dan perawatan di lapangan.' },
  { label: 'Dokumentasi', detail: 'Dukungan dokumentasi teknis yang bisa diperiksa.' },
];

export const NEUTRAL_CRITERIA_EN: readonly Criterion[] = [
  { label: 'Pressure class', detail: 'Pressure class suited to the installation needs.' },
  { label: 'Sizes and fittings', detail: 'Availability of matching sizes and fittings.' },
  { label: 'Standards', detail: 'Compliance with the standards that apply to the intended use.' },
  { label: 'Installation', detail: 'Ease of installation and maintenance in the field.' },
  { label: 'Documentation', detail: 'Technical documentation support that can be verified.' },
];

export function neutralCriteria(locale: Locale = DEFAULT_LOCALE): readonly Criterion[] {
  return locale === 'en' ? NEUTRAL_CRITERIA_EN : NEUTRAL_CRITERIA;
}

export interface ScopeInput {
  readonly buildingType: BuildingType | null;
  readonly installationType: InstallationType | null;
  readonly floors: number | null;
  /**
   * Beban alat suplai (WSFU) dari kebutuhan yang sudah tercatat. Di atas kurva Hunter yang
   * dipakai aturan (ENG-701/ENG-801) debit puncaknya tidak ada di tabel — kasusnya ke tim
   * teknis, bukan dihitung dengan angka karangan.
   */
  readonly supplyLoadWsfu?: number | null;
}

/** Di atas ini bangunan dianggap besar dan butuh validasi teknis (SPEC §5 Policy 5). */
const LARGE_BUILDING_FLOORS = 4;

/** Jumlah lantai di atas batas rekomendasi otomatis — gedung ini selalu ke tim teknis. */
export function exceedsAutomaticFloors(floors: number): boolean {
  return floors > LARGE_BUILDING_FLOORS;
}

/**
 * Policy 5 — scope routing.
 *
 * Air bersih dan pembuangan rumah tinggal / komersial kecil dihitung (pembuangan sejak
 * 2026-10-12, Kelompok J — laporan pemilik "kok ngga mau ngitung"). Industri tetap ke
 * validasi teknis (layar 11).
 *
 * Urutannya penting: industri diperiksa lebih dulu karena ia menang atas apa pun
 * jenis instalasinya.
 */
export function scopePolicy(input: ScopeInput, locale: Locale = DEFAULT_LOCALE): PolicyOutcome {
  const en = locale === 'en';
  if (input.buildingType === 'industrial') {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        en
          ? 'Industrial installations require review by the Pralon technical team.'
          : 'Instalasi industri memerlukan pemeriksaan tim teknis Pralon.',
      ],
    };
  }

  if (input.floors !== null && input.floors > LARGE_BUILDING_FLOORS) {
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        en
          ? `A ${input.floors}-storey building is outside the scope of automatic recommendations.`
          : `Bangunan ${input.floors} lantai berada di luar cakupan rekomendasi otomatis.`,
      ],
    };
  }

  // Produksi 2026-10-27: sekolah 3 lantai dengan 24 toilet (156 WSFU) membuat analisisnya
  // gagal dengan "layanan tidak tersedia" — sesudah SNOUTY menjanjikan hitungannya.
  const load = input.supplyLoadWsfu;
  if (load !== null && load !== undefined && load > HUNTER_TABLE_MAX_WSFU) {
    const wsfu = load.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
    return {
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        en
          ? `The plumbing fixture load adds up to ${wsfu} units, above the ${HUNTER_TABLE_MAX_WSFU} units the peak-flow curve covers, so the peak flow for a building this size is worked out by the Pralon technical team.`
          : `Beban alat plambingnya ${wsfu} unit, di atas ${HUNTER_TABLE_MAX_WSFU} unit yang tercakup kurva debit puncak, jadi debit puncak bangunan sebesar ini dihitung tim teknis Pralon.`,
      ],
    };
  }

  return { kind: 'supported' };
}
