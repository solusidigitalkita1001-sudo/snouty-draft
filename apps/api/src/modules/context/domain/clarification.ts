/**
 * ClarificationEngine — memilih pertanyaan berikutnya untuk field yang kurang.
 * docs/CONTEXT_ENGINE.md §5. **Fungsi murni, tanpa LLM.**
 *
 * Satu engine melayani dua bentuk desain (OQ-23):
 *   - 1–2 field kurang → satu pertanyaan per giliran + chip (bentuk prototipe).
 *   - ≥ 3 field kurang → kartu hingga 4 pertanyaan bernomor + "lewati, pakai
 *     asumsi standar" (bentuk board layar 03).
 *
 * Aturan keras (SPEC §33d): **tidak pernah menumpahkan kuesioner panjang** —
 * maksimum empat pertanyaan, selalu progresif, selalu menurut urutan prioritas.
 *
 * Catatan: kalimat pertanyaan di sini adalah templat tetap, bukan hasil LLM. Model
 * boleh memperhalus redaksinya nanti, tetapi *pilihan field dan urutannya* adalah
 * aturan bisnis dan wajib hidup di kode (SPEC §5), bukan di prompt.
 */

import type { ClarificationQuestion, RequirementFieldPath } from '@snouty/shared-types';

export const MAX_CLARIFICATION_QUESTIONS = 4;

/** Ambang bentuk kartu vs pertanyaan tunggal. */
const CARD_THRESHOLD = 3;

/**
 * Urutan prioritas (ENG-007, masih menunggu validasi domain — OQ-06). Field yang
 * paling menentukan arah solusi ditanya lebih dulu: tanpa sumber air, tidak ada
 * yang bisa dihitung.
 */
export const CLARIFICATION_PRIORITY: readonly RequirementFieldPath[] = [
  'water.source',
  'water.installationType',
  'building.floors',
  'fixtures.bathrooms',
];

interface QuestionTemplate {
  readonly question: string;
  readonly options: readonly string[];
}

const TEMPLATES: Readonly<Partial<Record<RequirementFieldPath, QuestionTemplate>>> = {
  'water.source': {
    question: 'Sumber airnya dari mana?',
    options: ['Toren atap', 'Toren bawah', 'Pompa', 'PDAM'],
  },
  'water.installationType': {
    question: 'Instalasi ini untuk apa?',
    options: ['Air bersih', 'Pembuangan', 'Keduanya'],
  },
  'building.floors': {
    question: 'Bangunannya berapa lantai?',
    options: ['1', '2', '3', '4'],
  },
  'fixtures.bathrooms': {
    question: 'Ada berapa kamar mandi?',
    options: ['1', '2', '3', '4'],
  },
};

export type ClarificationForm = 'single' | 'card';

export interface ClarificationPlan {
  readonly form: ClarificationForm;
  readonly questions: readonly ClarificationQuestion[];
  /** Bentuk kartu menawarkan jalan pintas "pakai asumsi standar". */
  readonly allowSkipToDefaults: boolean;
}

/**
 * Menyusun rencana klarifikasi dari daftar field yang kurang. Field diurutkan
 * menurut prioritas (yang di luar prioritas ikut di belakang, stabil), lalu
 * dipotong maksimum empat. Bentuk tunggal hanya memakai field pertama.
 */
export function planClarification(
  missing: readonly RequirementFieldPath[],
): ClarificationPlan | null {
  if (missing.length === 0) return null;

  const ordered = orderByPriority(missing);
  const form: ClarificationForm = missing.length >= CARD_THRESHOLD ? 'card' : 'single';
  const selected =
    form === 'single' ? ordered.slice(0, 1) : ordered.slice(0, MAX_CLARIFICATION_QUESTIONS);

  const questions = selected.map(toQuestion).filter((q): q is ClarificationQuestion => q !== null);

  return {
    form,
    questions,
    allowSkipToDefaults: form === 'card',
  };
}

function orderByPriority(
  missing: readonly RequirementFieldPath[],
): readonly RequirementFieldPath[] {
  const rank = (path: RequirementFieldPath): number => {
    const index = CLARIFICATION_PRIORITY.indexOf(path);
    return index === -1 ? CLARIFICATION_PRIORITY.length : index;
  };
  return [...missing].sort((a, b) => rank(a) - rank(b));
}

function toQuestion(path: RequirementFieldPath): ClarificationQuestion | null {
  const template = TEMPLATES[path];
  if (!template) return null;
  return {
    id: path,
    question: template.question,
    options: template.options,
    allowUnknown: true, // "Belum tahu" selalu tersedia — pengguna tidak dipaksa menebak.
  };
}
