/**
 * Default "Belum tahu" dan kartu asumsi. docs/CONTEXT_ENGINE.md §5 · ENG-014.
 * **Fungsi murni, tanpa LLM.**
 *
 * Menjawab "Belum tahu" bukan jalan buntu: sistem menerapkan default, menandainya
 * `ASSUMED`, dan **selalu** memunculkannya di kartu asumsi dengan kalimat yang
 * terbaca manusia. Menerapkan default tanpa mengatakannya melanggar SPEC §5 Policy 4
 * dan — lebih buruk — membuat pengguna percaya pada angka yang sebetulnya tebakan.
 *
 * Invarian TV-1: setiap field `ASSUMED` WAJIB membawa `reason`. Di sinilah hal itu
 * dipastikan — `reason` berasal dari tabel, bukan dirangkai LLM, sehingga kalimatnya
 * stabil dan bisa diuji.
 */

import {
  DEFAULT_LOCALE,
  type BuildingType,
  type FieldSource,
  type Locale,
  type RequirementFieldPath,
  type RequirementState,
  type TrackedValue,
} from '@snouty/shared-types';
import type { FieldUpdate } from './context-merger.js';

export interface RequirementDefault {
  readonly path: RequirementFieldPath;
  readonly value: unknown;
  /** Kalimat yang muncul di kartu asumsi — persis, tidak diparafrase. */
  readonly reason: string;
  readonly ruleId: string;
}

/**
 * Tabel default (docs/CONTEXT_ENGINE.md §5). `dimensions` tidak punya nilai default
 * tetap — ketiadaannya menjadikan BOM `ESTIMATED`, ditangani di Engineering Engine
 * (Fase 6), bukan diisi angka di sini. Karena itu ia tidak ada di tabel ini.
 */
export const REQUIREMENT_DEFAULTS: readonly RequirementDefault[] = [
  {
    path: 'water.source',
    value: 'rooftop_tank',
    reason: 'Sumber distribusi adalah toren atap, tanpa pompa pendorong.',
    ruleId: 'ENG-014',
  },
  {
    path: 'water.installationType',
    value: 'clean_water',
    reason: 'Instalasi diasumsikan untuk air bersih saja.',
    ruleId: 'ENG-014',
  },
  {
    path: 'building.floorHeightM',
    value: 3.5,
    reason: 'Tinggi antar lantai diasumsikan 3,5 meter.',
    ruleId: 'ENG-014',
  },
  // Nilainya jumlah lantai rumah itu (`defaultUpdateFor` dengan state) — tanpa lantai, tanpa default.
  {
    path: 'fixtures.bathrooms',
    value: null,
    reason: 'Jumlah kamar mandi diasumsikan 1 per lantai.',
    ruleId: 'ENG-014',
  },
  // Ganti sebagian (smoke test 13 Nov 2026, temuan 1): pipa lamanya ditanya lebih dulu karena
  // segmen pengganti mengikuti ukurannya. "Belum tahu" tetap bukan jalan buntu — ukuran yang tidak
  // diketahui membuat kapasitas pipa lama disebut belum dicek, dan bahan yang tidak diketahui
  // memakai kopling transisi (ENG-902 `unknown`), bukan sok lem yang belum pasti pas.
  {
    path: 'water.existingMainSize',
    value: 'unknown',
    reason: 'Ukuran pipa lama belum diketahui, jadi kapasitasnya tidak dicek.',
    ruleId: 'ENG-014',
  },
  {
    path: 'water.existingPipeMaterial',
    value: 'unknown',
    reason: 'Bahan pipa lama belum diketahui, jadi sambungannya memakai kopling transisi.',
    ruleId: 'ENG-014',
  },
];

/** Kembaran Inggris `reason` tiap default — kunci sama dengan path di `REQUIREMENT_DEFAULTS`. */
export const REQUIREMENT_DEFAULT_REASONS_EN: Readonly<
  Partial<Record<RequirementFieldPath, string>>
> = {
  'water.source': 'The distribution source is a rooftop tank, with no booster pump.',
  'water.installationType': 'The installation is assumed to be for clean water only.',
  'building.floorHeightM': 'Floor-to-floor height is assumed to be 3.5 metres.',
  'fixtures.bathrooms': 'The number of bathrooms is assumed to be 1 per floor.',
  'water.existingMainSize': 'The existing pipe size is not known, so its capacity is not checked.',
  'water.existingPipeMaterial':
    'The existing pipe material is not known, so the joint uses a transition coupling.',
};

/** Kalimat alasan default menurut bahasa; Indonesia = `reason` tabel apa adanya. */
export function defaultReason(def: RequirementDefault, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? (REQUIREMENT_DEFAULT_REASONS_EN[def.path] ?? def.reason) : def.reason;
}

const BY_PATH: ReadonlyMap<RequirementFieldPath, RequirementDefault> = new Map(
  REQUIREMENT_DEFAULTS.map((d) => [d.path, d]),
);

/**
 * Update default untuk satu field — `source: 'default_applied'`, `ASSUMED`, dengan
 * `reason`. Karena `default_applied` adalah sumber terlemah, merge otomatis menolak
 * menimpa apa pun yang disebut pengguna; aman dipanggil untuk field yang mungkin
 * sudah terisi. Mengembalikan `null` bila field tidak punya default (mis.
 * `building.dimensions`).
 */
export function defaultUpdateFor(
  path: RequirementFieldPath,
  /** State saat ini — kamar mandi dihitung dari jumlah lantainya. */
  state?: RequirementState,
): FieldUpdate | null {
  const def = BY_PATH.get(path);
  if (!def) return null;
  const value = path === 'fixtures.bathrooms' ? (state?.building.floors.value ?? null) : def.value;
  if (value === null) return null;
  return {
    path: def.path,
    value,
    source: 'default_applied' satisfies FieldSource,
    provenance: 'ASSUMED',
    reason: def.reason,
    ruleId: def.ruleId,
  };
}

/** Data inti rumah yang boleh dianggap saat lantainya sudah disebut. */
const HOUSE_ASSUMABLE: readonly RequirementFieldPath[] = [
  'fixtures.bathrooms',
  'water.source',
  'water.installationType',
];

/**
 * Tambahannya saat pengguna SENDIRI meminta menghitung: data pipa lama pada penggantian sebagian.
 * Ia tidak ikut anggapan otomatis — tanpa diminta, ukuran dan bahan pipa yang sedang dipotong
 * ditanya lebih dulu (smoke test 13 Nov 2026, temuan 1). Tetapi "udah, itung aja" adalah izin:
 * keduanya menjadi `unknown`, dihitung dengan peringatan "ukuran pipa lama belum disebut", bukan
 * pertanyaan yang sama untuk kedua kalinya.
 */
const ASSUMABLE_ON_REQUEST: readonly RequirementFieldPath[] = [
  ...HOUSE_ASSUMABLE,
  'water.existingMainSize',
  'water.existingPipeMaterial',
];

/**
 * Jenis bangunan yang dihitung langsung begitu lantainya disebut. Industri tidak termasuk: ia
 * tetap lewat tim teknis, karena fluida dan bebannya bukan air bersih bangunan.
 */
const COMPUTE_FIRST_TYPES: ReadonlySet<BuildingType> = new Set<BuildingType>([
  'residential',
  'boarding_house',
  'light_commercial',
  'place_of_worship',
  'public_building',
]);

/**
 * "Hitung dulu + asumsi" (pemilik 2026-10-20, diperluas 2026-11-02): bangunan yang jumlah
 * lantainya disebut dihitung langsung — data inti lain yang belum disebut diisi anggapan bertanda
 * (`ASSUMED`, ENG-014) dan tertulis di jawaban, jadi pengguna bisa mengoreksinya. Masjid, gedung
 * publik, ruko, dan kos ikut aturan rumah (produksi 2026-11-02: masjid 2 lantai dengan 20 keran
 * wudhu, 4 toilet, dan toren atap masih dijawab "saya masih perlu jenis instalasi"). Tanpa jumlah
 * lantai, dengan data lain yang belum lengkap, atau tanpa jenis bangunan yang disebut, tidak ada
 * anggapan: yang kurang ditanyakan seperti biasa.
 */
export function computeFirstAssumptionUpdates(state: RequirementState): readonly FieldUpdate[] {
  const type = state.building.type.value;
  if (type === null || type === undefined || !COMPUTE_FIRST_TYPES.has(type)) return [];
  return assumableUpdates(state);
}

/**
 * Data inti yang belum disebut tetapi punya anggapan, untuk SEMUA jenis bangunan. Dipakai saat
 * pengguna sendiri meminta menghitung ("udah, itung aja" di percakapan ruko 3 lantai, produksi
 * 2026-10-26): permintaan itu izin memakai anggapan, bukan alasan mengulang pertanyaan yang sama.
 * Anggapannya tetap ditandai ASSUMED dengan alasannya, jadi tetap terlihat di jawaban. Tanpa
 * jumlah lantai, atau dengan data lain yang tidak boleh dianggap, tidak ada anggapan.
 */
export function assumableUpdates(
  state: RequirementState,
  /** Diminta pengguna sendiri — anggapan yang lebih luas berlaku (`ASSUMABLE_ON_REQUEST`). */
  onRequest = false,
): readonly FieldUpdate[] {
  if (state.useCase !== undefined) return [];
  if (state.building.floors.value === null) return [];
  const missing = state.missingInformation;
  // Titik air yang disebut pengguna ("titik airnya ada 9") tidak boleh dilangkahi anggapan 1
  // kamar mandi per lantai: anggapan itu menghasilkan 7 titik, dan solusinya memberi tahu
  // pengguna angka yang bukan angkanya (produksi 2026-10-26). Bauran alatnya ditanya, bukan
  // dikarang — aturan tetapnya OQ-85.
  if (state.fixtures.outletCount.value !== null && missing.includes('fixtures.bathrooms'))
    return [];
  // Kos yang jumlah kamarnya disebut: anggapan 1 kamar mandi per LANTAI jelas bukan angkanya —
  // 10 kamar di 2 lantai akan menjadi 2 kamar mandi. Yang menentukan jawaban pengguna sendiri.
  if (
    state.building.rooms?.value !== null &&
    state.building.rooms?.value !== undefined &&
    missing.includes('fixtures.bathrooms')
  )
    return [];
  const allowed = onRequest ? ASSUMABLE_ON_REQUEST : HOUSE_ASSUMABLE;
  if (missing.length === 0 || !missing.every((p) => allowed.includes(p))) return [];
  return missing
    .map((path) => defaultUpdateFor(path, state))
    .filter((u): u is FieldUpdate => u !== null);
}

export interface AssumptionCardItem {
  readonly path: RequirementFieldPath;
  readonly reason: string;
  readonly ruleId?: string;
}

/**
 * Kartu "Asumsi yang digunakan" — setiap field `ASSUMED` di state muncul di sini.
 * Bila ada field `ASSUMED` tanpa `reason`, itu pelanggaran TV-1; kami lempar alih-
 * alih merender kartu bisu, karena asumsi tak terlihat lebih berbahaya dari error.
 */
export function assumptionCard(
  fields: ReadonlyArray<readonly [RequirementFieldPath, TrackedValue<unknown>]>,
  locale: Locale = DEFAULT_LOCALE,
): readonly AssumptionCardItem[] {
  const items: AssumptionCardItem[] = [];
  for (const [path, value] of fields) {
    if (value.provenance !== 'ASSUMED') continue;
    if (!value.reason) {
      throw new Error(`invarian TV-1: field ASSUMED '${path}' tidak punya reason`);
    }
    // Reason tersimpan adalah kalimat Indonesia dari tabel default; di en dipakai kembarannya,
    // dan reason lain (bukan dari tabel) ditampilkan apa adanya.
    const def = BY_PATH.get(path);
    const reason =
      locale === 'en' && def !== undefined && value.reason === def.reason
        ? defaultReason(def, locale)
        : value.reason;
    items.push({
      path,
      reason,
      ...(value.ruleId !== undefined ? { ruleId: value.ruleId } : {}),
    });
  }
  return items;
}
