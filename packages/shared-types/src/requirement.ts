/**
 * RequirementState — kebutuhan pengguna sebagai state terstruktur, bukan transkrip.
 * docs/CONTEXT_ENGINE.md §2 · docs/DOMAIN_MODEL.md §4.
 *
 * Setiap field adalah `TrackedValue`, tidak pernah skalar telanjang: nilai tanpa
 * asal-usul adalah nilai yang tidak bisa dipertanggungjawabkan saat ditampilkan
 * (SPEC §5 Policy 4). Konteks inilah yang dikirim ke LLM — bukan riwayat chat
 * mentah — sehingga model tidak pernah menebak ulang apa yang sudah diketahui.
 */

import type { TrackedValue } from './provenance.js';

/**
 * Intent satu giliran percakapan. Kosakata tertutup; intent router memetakan
 * pesan bebas ke salah satunya, bukan mengarang nilai sendiri.
 *
 * Dua pembedaan yang menentukan (docs/AI_BEHAVIOR.md):
 *   - `PRODUCT_LOOKUP` dijawab query MySQL, bukan pencarian semantik.
 *   - `REQUIREMENT_MUTATION` mengubah state; `EXPLANATION_REQUEST` tidak. Salah di
 *     sini berarti mengubah kebutuhan pengguna tanpa diminta — maka bila ragu,
 *     sistem bertanya (`CLARIFICATION_NEEDED`), tidak menebak.
 */
export type Intent =
  | 'REQUIREMENT_STATEMENT'
  | 'REQUIREMENT_MUTATION'
  | 'PRODUCT_LOOKUP'
  | 'EXPLANATION_REQUEST'
  | 'CLARIFICATION_ANSWER'
  | 'COMPETITOR_QUESTION'
  | 'OUT_OF_SCOPE'
  | 'CLARIFICATION_NEEDED';

export type BuildingType = 'residential' | 'boarding_house' | 'light_commercial' | 'industrial';
export type WaterSource = 'rooftop_tank' | 'ground_tank' | 'pump' | 'municipal';
export type InstallationType = 'clean_water' | 'drainage' | 'both';

export interface Dimensions {
  readonly mainRunMeters: number;
}

export interface BuildingState {
  readonly type: TrackedValue<BuildingType>;
  readonly floors: TrackedValue<number>;
  /** Default 3,5 m → `ASSUMED` (ENG-004). */
  readonly floorHeightM: TrackedValue<number>;
  /** Kosong → BOM menjadi `ESTIMATED`, bukan `VERIFIED`. */
  readonly dimensions: TrackedValue<Dimensions>;
}

export interface FixtureState {
  readonly bathrooms: TrackedValue<number>;
  readonly basins: TrackedValue<number>;
  readonly kitchens: TrackedValue<number>;
  /** Ditanyakan langsung di board layar 03. */
  readonly outletCount: TrackedValue<number>;
}

export interface WaterState {
  readonly source: TrackedValue<WaterSource>;
  readonly installationType: TrackedValue<InstallationType>;
  /** Ditanyakan langsung di board layar 03. */
  readonly boosterPump: TrackedValue<boolean>;
}

/** Jalur bidang yang bisa dirujuk klarifikasi dan daftar informasi kurang. */
export type RequirementFieldPath =
  | 'building.type'
  | 'building.floors'
  | 'building.floorHeightM'
  | 'building.dimensions'
  | 'fixtures.bathrooms'
  | 'fixtures.basins'
  | 'fixtures.kitchens'
  | 'fixtures.outletCount'
  | 'water.source'
  | 'water.installationType'
  | 'water.boosterPump';

/**
 * Empat field inti yang menggerakkan meter "KELENGKAPAN DATA" dan menahan
 * rekomendasi (docs/CONTEXT_ENGINE.md §5). Field lain memperkaya hasil tetapi
 * tidak menahannya — angka 4 di sini satu sumber, bukan tersebar di kode.
 */
export const CORE_REQUIREMENT_FIELDS = [
  'water.source',
  'water.installationType',
  'building.floors',
  'fixtures.bathrooms',
] as const satisfies readonly RequirementFieldPath[];

export interface RequirementCompleteness {
  readonly filled: number;
  readonly required: 4;
}

/**
 * Jalur guna IRIGASI (keputusan pemilik 2026-10-06, OQ-47): kebutuhannya dikumpulkan dengan
 * kartu klarifikasi khusus, diberi arahan produk umum, lalu diteruskan ke tim teknis secara
 * terstruktur. Sizing otomatisnya menunggu aturan teknik irigasi dari Pralon — field-nya
 * sengaja terpisah dari field bangunan supaya mesin teknik tidak pernah menghitung dari
 * data yang bukan bangunan.
 */
export type IrrigationField =
  | 'irrigation.source'
  | 'irrigation.areaHa'
  | 'irrigation.method'
  | 'irrigation.distance'
  | 'irrigation.elevation'
  | 'irrigation.pump';

export interface IrrigationUseCase {
  readonly kind: 'irrigation';
  /** Jawaban apa adanya (label pilihan atau nilai yang disebut), `undefined` = belum ditanya/dijawab. */
  readonly answers: Readonly<Partial<Record<IrrigationField, string>>>;
}

/**
 * Jalur KASUS TEKNIS UMUM (Fase 14 — asisten teknik perpipaan umum): transfer pompa, saluran
 * gravitasi, air hujan, gorong-gorong, sumur, cluster, gedung bertingkat. Nilai disimpan
 * dengan kunci parameter universal (`packages/engineering` ParameterRegistry) — bukan field
 * bangunan — dan membawa asal-usulnya: `known` disebut/dipilih pengguna, `assumed` diisi.
 */
export interface TechnicalParameter {
  /** Label bahasa pengguna dari registry, disalin supaya klien tidak perlu registry. */
  readonly label: string;
  readonly value: number | string | boolean;
  readonly unit?: string;
  readonly origin: 'known' | 'assumed';
  /** Potongan kalimat pengguna yang menjadi dasarnya. */
  readonly evidence?: string;
}

export interface TechnicalUseCase {
  readonly kind: 'technical';
  /** `CaseId` profil kasus di `packages/engineering`; string supaya tipe ini tidak bergantung ke sana. */
  readonly caseId: string;
  readonly parameters: Readonly<Record<string, TechnicalParameter>>;
}

export type UseCaseState = IrrigationUseCase | TechnicalUseCase;

export interface RequirementState {
  readonly version: number;
  readonly intent: Intent;
  readonly building: BuildingState;
  readonly fixtures: FixtureState;
  readonly water: WaterState;
  /** Turunan, tidak disimpan — dihitung dari state (docs/CONTEXT_ENGINE.md §2). */
  readonly missingInformation: readonly RequirementFieldPath[];
  readonly completeness: RequirementCompleteness;
  /** Jalur guna khusus (irigasi); tidak ada = jalur bangunan biasa. */
  readonly useCase?: UseCaseState;
}

/** Pemicu sebuah snapshot terbentuk (kolom `requirement_snapshots.trigger`). */
export type SnapshotTrigger =
  'extraction' | 'clarification_answer' | 'user_edit' | 'default_applied';
