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

export function evaluateCompleteness(state: RequirementState): CompletenessResult {
  const missing = CORE_REQUIREMENT_FIELDS.filter((path) => !isFilled(readField(state, path)));
  const filled = CORE_REQUIREMENT_FIELDS.length - missing.length;

  return {
    completeness: { filled, required: 4 },
    missingInformation: missing,
    isComplete: missing.length === 0,
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
