/**
 * Kewajaran masukan rumah di percakapan (review putaran 3, kelompok 2). Pemeriksaannya di engine
 * (`houseInputIssues`); di sini: fakta dari state, kartu tanya balik, dan penegasan pengguna.
 *
 * Alurnya: angka janggal → kartu "sudah benar?" dengan isian ukuran untuk membetulkan → pengguna
 * membetulkan (masalahnya hilang) atau menegaskan (kode masuk `confirmedOutliers`, hitungan jalan,
 * laporan mencatatnya). Tombol Susun rekomendasi tidak tampil selama masih ada yang belum dijawab.
 */

import { houseInputIssues, type HouseInputIssue, type HouseOutlierCode } from '@snouty/engineering';
import type {
  Assumption,
  ClarificationQuestion,
  Locale,
  RequirementState,
} from '@snouty/shared-types';
import type { FieldUpdate } from './context-merger.js';
import { dimensionQuestionInputs, parseDimensionAnswer } from './clarification.js';

/** Awalan `id` jawaban kartu kewajaran: `outlier.area_per_bathroom`. */
export const OUTLIER_ANSWER_PREFIX = 'outlier.';
/** Pilihan penegasan — protokol (label Indonesia kanonik). */
export const OUTLIER_CONFIRM = 'Sudah benar';

const CODES: readonly HouseOutlierCode[] = ['area_per_bathroom', 'land_smaller_than_building'];

/** Masalah kewajaran dari state jalur bangunan; jalur irigasi/teknis punya pagarnya sendiri. */
export function stateInputIssues(state: RequirementState): readonly HouseInputIssue[] {
  if (state.useCase !== undefined) return [];
  const d = state.building.dimensions.value;
  return houseInputIssues({
    floors: state.building.floors.value,
    bathrooms: state.fixtures.bathrooms.value,
    ...(d?.lengthM !== undefined ? { lengthM: d.lengthM } : {}),
    ...(d?.widthM !== undefined ? { widthM: d.widthM } : {}),
    ...(d?.areaM2 !== undefined ? { areaM2: d.areaM2 } : {}),
    ...(d?.landLengthM !== undefined ? { landLengthM: d.landLengthM } : {}),
    ...(d?.landWidthM !== undefined ? { landWidthM: d.landWidthM } : {}),
    ...(d?.landAreaM2 !== undefined ? { landAreaM2: d.landAreaM2 } : {}),
  });
}

/** Masalah yang belum ditegaskan pengguna — menahan tombol Susun rekomendasi. */
export function pendingOutliers(state: RequirementState): readonly HouseInputIssue[] {
  const confirmed = new Set(state.confirmedOutliers ?? []);
  return stateInputIssues(state).filter((issue) => !confirmed.has(issue.code));
}

export function outlierQuestions(
  issues: readonly HouseInputIssue[],
  locale: Locale,
): readonly ClarificationQuestion[] {
  const en = locale === 'en';
  return issues.map((issue) => ({
    id: `${OUTLIER_ANSWER_PREFIX}${issue.code}`,
    question: en ? issue.questionEn : issue.question,
    options: [OUTLIER_CONFIRM],
    ...(en ? { optionLabels: ['Yes, that is right'] } : {}),
    inputs: dimensionQuestionInputs(locale),
    allowUnknown: false,
  }));
}

export function isOutlierAnswerId(id: string): boolean {
  return CODES.some((code) => id === `${OUTLIER_ANSWER_PREFIX}${code}`);
}

/**
 * Jawaban kartu kewajaran: penegasan → kode untuk `confirmedOutliers`; ukuran baru → pembaruan
 * `building.dimensions` dari pengguna. Selain itu `null`.
 */
export function outlierAnswer(answer: {
  readonly id: string;
  readonly option: string;
}): { readonly confirm: HouseOutlierCode } | { readonly update: FieldUpdate } | null {
  if (!isOutlierAnswerId(answer.id)) return null;
  const code = answer.id.slice(OUTLIER_ANSWER_PREFIX.length) as HouseOutlierCode;
  if (answer.option === OUTLIER_CONFIRM) return { confirm: code };
  const dimensions = parseDimensionAnswer(answer.option);
  return dimensions === null
    ? null
    : { update: { path: 'building.dimensions', value: dimensions, source: 'user_stated' } };
}

/** State baru dengan kode-kode yang ditegaskan; `changed` bila ada yang baru. */
export function confirmOutliers(
  state: RequirementState,
  codes: readonly HouseOutlierCode[],
): { readonly state: RequirementState; readonly changed: boolean } {
  const current = new Set(state.confirmedOutliers ?? []);
  const fresh = codes.filter((code) => !current.has(code));
  if (fresh.length === 0) return { state, changed: false };
  return {
    state: { ...state, confirmedOutliers: [...current, ...fresh] },
    changed: true,
  };
}

/**
 * Baris tabel asumsi untuk laporan dan layar solusi: setiap masalah kewajaran yang masih ada di
 * data (ditegaskan atau tidak) dicatat untuk diverifikasi (permintaan review putaran 3).
 */
export function outlierAssumptions(state: RequirementState, locale: Locale): readonly Assumption[] {
  const en = locale === 'en';
  return stateInputIssues(state).map((issue) => ({
    text: en
      ? `Data outside the usual range, please verify: ${issue.noteEn}`
      : `Data di luar kewajaran, mohon diverifikasi: ${issue.note}`,
    fieldPath: 'building.dimensions',
  }));
}
