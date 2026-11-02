/**
 * CompletenessEvaluator — menghitung meter "KELENGKAPAN DATA" dan daftar informasi
 * yang masih kurang. **Fungsi murni.** docs/CONTEXT_ENGINE.md §5.
 *
 * Hanya **empat field inti** yang menahan rekomendasi; field lain memperkaya hasil
 * tetapi tidak menahannya. Sumber empat field itu tunggal — `CORE_REQUIREMENT_FIELDS`
 * di shared-types — supaya meter dan engine klarifikasi tidak pernah menyimpang soal
 * "apa yang wajib".
 */

import {
  CORE_REQUIREMENT_FIELDS,
  type RequirementCompleteness,
  type RequirementFieldPath,
  type RequirementState,
} from '@snouty/shared-types';
import { isFilled, readField } from './requirement-field.js';

export interface CompletenessResult {
  readonly completeness: RequirementCompleteness;
  readonly missingInformation: readonly RequirementFieldPath[];
  readonly isComplete: boolean;
}

/**
 * Rentang tinggi tiap lantai yang dihitung — sama dengan pagar engine (ENG-702) dan skema
 * ekstraksi. Nilai yang disebut di luar rentang tidak dihitung dan tidak diganti asumsi: ia
 * ditanyakan balik (TC-H-02, TC-G-01).
 */
export const FLOOR_HEIGHT_RANGE_M = { min: 2, max: 10 } as const;

/** Tinggi lantai yang disebut pengguna tetapi di luar rentang yang bisa dihitung. */
export function floorHeightOutOfRange(state: RequirementState): number | null {
  const value = state.building.floorHeightM.value;
  return typeof value === 'number' &&
    (value < FLOOR_HEIGHT_RANGE_M.min || value > FLOOR_HEIGHT_RANGE_M.max)
    ? value
    : null;
}

/**
 * Data inti pekerjaan ini. Pekerjaan PEMBUANGAN saja tidak punya sumber air: buangan mengalir
 * karena gravitasi, kebutuhan sumbernya pun dilewati saat menyusun daftar (`solution-needs`), dan
 * hitungannya tidak berubah seujung pun karena airnya datang dari toren atau PDAM. Jadi sumber air
 * tidak ditanyakan dan tidak dianggap di situ — di produksi 2026-11-02 pekerjaan saluran air kotor
 * dijawab "yang belum disebut saya anggap dulu air dari toren atap tanpa pompa pendorong", kalimat
 * yang tidak ada hubungannya dengan pekerjaan yang diminta.
 */
function coreFieldsFor(state: RequirementState): readonly RequirementFieldPath[] {
  return state.water.installationType.value === 'drainage'
    ? CORE_REQUIREMENT_FIELDS.filter((path) => path !== 'water.source')
    : CORE_REQUIREMENT_FIELDS;
}

export function evaluateCompleteness(state: RequirementState): CompletenessResult {
  const core = coreFieldsFor(state);
  const missing = core.filter((path) => !isFilled(readField(state, path)));
  const filled = core.length - missing.length;
  // Tinggi lantai di luar rentang menahan rekomendasi sampai dikoreksi.
  const blocked: RequirementFieldPath[] = [
    ...(floorHeightOutOfRange(state) !== null ? (['building.floorHeightM'] as const) : []),
    // Renovasi yang jenisnya belum disebut (P23-03): ditanya, bukan ditebak bangun baru.
    ...(state.water.workType?.value === 'renovation' ? (['water.workType'] as const) : []),
    // Kos yang jumlah kamarnya disebut: kamar mandi di dalam tiap kamar atau bersama ditanya
    // sekali, dan sampai itu dijawab tidak ada yang dihitung (keputusan pemilik 2026-11-02).
    ...(state.building.rooms?.value !== null &&
    state.building.rooms?.value !== undefined &&
    !isFilled(readField(state, 'fixtures.bathrooms')) &&
    !isFilled(readField(state, 'fixtures.bathroomsPerRoom'))
      ? (['fixtures.bathroomsPerRoom'] as const)
      : []),
  ];

  return {
    completeness: { filled, required: core.length as 3 | 4 },
    missingInformation: [...missing, ...blocked],
    isComplete: missing.length + blocked.length === 0,
  };
}

/**
 * Menyalin hasil kelengkapan ke dalam state — satu-satunya penulis `completeness`
 * dan `missingInformation`, keduanya turunan. Dipanggil setelah setiap merge.
 */
export function withCompleteness(state: RequirementState): RequirementState {
  const result = evaluateCompleteness(state);
  return {
    ...state,
    completeness: result.completeness,
    missingInformation: result.missingInformation,
  };
}

/**
 * Teks di bawah meter — salinan desain persis (docs/CONTEXT_ENGINE.md §5). Dipisah
 * dari komponen supaya satu kalimat kebijakan ("asumsi") hidup di satu tempat.
 */
export function completenessCaption(result: CompletenessResult): string {
  if (result.isComplete) {
    return 'Data inti sudah lengkap. Nilai yang tidak diberikan tetap ditandai sebagai asumsi.';
  }
  const n = result.missingInformation.length;
  return `${n} kelompok data lagi sebelum SNOUTY dapat menyusun rekomendasi.`;
}
