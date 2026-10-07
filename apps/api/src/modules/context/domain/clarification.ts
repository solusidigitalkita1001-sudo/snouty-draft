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
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type { FieldUpdate } from './context-merger.js';
import {
  isParameterKey,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
} from '@snouty/engineering';
import { irrigationFieldLabel, isIrrigationField } from './irrigation.js';

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

/**
 * Dua bahasa (Fase 15): `options` tetap label Indonesia kanonik sebagai PROTOKOL (klien
 * mengirimnya balik apa adanya, `answerToUpdate` membacanya), sedangkan pertanyaan dan label
 * tampilan mengikuti bahasa percakapan lewat `optionLabels`.
 */
const QUESTION_EN: Readonly<Partial<Record<RequirementFieldPath, string>>> = {
  'water.source': 'Where does the water come from?',
  'water.installationType': 'What is this installation for?',
  'building.floors': 'How many floors does the building have?',
  'fixtures.bathrooms': 'How many bathrooms are there?',
};

/** Label tampilan Inggris per nilai pilihan kanonik; angka tampil apa adanya. */
const OPTION_LABEL_EN: Readonly<Record<string, string>> = {
  'Toren atap': 'Rooftop tank',
  'Toren bawah': 'Ground tank',
  Pompa: 'Pump',
  PDAM: 'Municipal water',
  'Air bersih': 'Clean water',
  Pembuangan: 'Drainage',
  Keduanya: 'Both',
  'Belum tahu': 'Not sure',
};

export function optionLabel(option: string, locale: Locale): string {
  return locale === 'en' ? (OPTION_LABEL_EN[option] ?? option) : option;
}

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
/** Field inti yang kartunya bisa dijawab — sama dengan yang ditanyakan `planClarification`. */
const CORE_CLARIFICATION_IDS: ReadonlySet<string> = new Set<RequirementFieldPath>([
  'water.source',
  'water.installationType',
  'building.floors',
  'fixtures.bathrooms',
]);

/**
 * `id` jawaban kartu klarifikasi yang dikenal: field inti bangunan, field irigasi (OQ-47), atau
 * kunci parameter kasus teknis (Fase 14). Satu daftar untuk validasi endpoint, supaya setiap
 * kartu yang dikirim API memang bisa dijawab lewat API.
 */
export function isClarificationAnswerId(id: string): boolean {
  return CORE_CLARIFICATION_IDS.has(id) || isIrrigationField(id) || isParameterKey(id);
}

export function planClarification(
  missing: readonly RequirementFieldPath[],
  locale: Locale = DEFAULT_LOCALE,
): ClarificationPlan | null {
  if (missing.length === 0) return null;

  const ordered = orderByPriority(missing);
  const form: ClarificationForm = missing.length >= CARD_THRESHOLD ? 'card' : 'single';
  const selected =
    form === 'single' ? ordered.slice(0, 1) : ordered.slice(0, MAX_CLARIFICATION_QUESTIONS);

  const questions = selected
    .map((path) => toQuestion(path, locale))
    .filter((q): q is ClarificationQuestion => q !== null);

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

/** Label chip yang selalu ada; jawaban ini memakai default (ASSUMED) bila field punya default. */
export const UNKNOWN_OPTION = 'Belum tahu';

/**
 * Nilai di balik tiap label chip — klien hanya tahu labelnya, nilainya urusan domain.
 * Pertanyaan berangka (lantai, kamar mandi) memetakan labelnya sebagai bilangan bulat.
 */
const OPTION_VALUES: Readonly<
  Partial<Record<RequirementFieldPath, Readonly<Record<string, unknown>>>>
> = {
  'water.source': {
    'Toren atap': 'rooftop_tank',
    'Toren bawah': 'ground_tank',
    Pompa: 'pump',
    PDAM: 'municipal',
  },
  'water.installationType': {
    'Air bersih': 'clean_water',
    Pembuangan: 'drainage',
    Keduanya: 'both',
  },
};

/** Label singkat untuk ringkasan jawaban di gelembung pengguna. */
const ANSWER_LABEL: Readonly<Partial<Record<RequirementFieldPath, string>>> = {
  'water.source': 'Sumber air',
  'water.installationType': 'Instalasi',
  'building.floors': 'Lantai',
  'fixtures.bathrooms': 'Kamar mandi',
};
const ANSWER_LABEL_EN: Readonly<Partial<Record<RequirementFieldPath, string>>> = {
  'water.source': 'Water source',
  'water.installationType': 'Installation',
  'building.floors': 'Floors',
  'fixtures.bathrooms': 'Bathrooms',
};

export interface ClarificationAnswer {
  readonly id: string;
  readonly option: string;
}

/**
 * Jawaban chip → pembaruan field, **nol LLM**: labelnya kita yang membuat, jadi nilainya
 * kita yang tahu. "Belum tahu" → default ASSUMED bila ada (`defaultUpdateFor`); field tanpa
 * default (lantai, kamar mandi) tetap kosong dan akan ditanya lagi. Label yang bukan dari
 * templat (klien usang, permintaan dirakit tangan) → `null`, bukan tebakan.
 */
export function answerToUpdate(
  answer: ClarificationAnswer,
  defaultFor: (path: RequirementFieldPath) => FieldUpdate | null,
): FieldUpdate | null {
  const path = answer.id as RequirementFieldPath;
  if (!TEMPLATES[path]) return null;
  if (answer.option === UNKNOWN_OPTION) return defaultFor(path);
  if (!TEMPLATES[path]!.options.includes(answer.option)) return null;
  const mapped = OPTION_VALUES[path]?.[answer.option];
  const value = mapped ?? (/^\d+$/.test(answer.option) ? Number(answer.option) : null);
  if (value === null) return null;
  return { path, value, source: 'user_stated' };
}

/** "Sumber air: Toren atap · Instalasi: Keduanya · Kamar mandi: 3" — gelembung pengguna. */
export function summarizeAnswers(
  answers: readonly ClarificationAnswer[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const labels = locale === 'en' ? ANSWER_LABEL_EN : ANSWER_LABEL;
  return answers
    .map((a) => {
      // Kunci parameter kasus teknis → label dan pilihan dari registry (bug "fluid_type: Air
      // limbah" di gelembung pengguna, 2026-10-07); field irigasi → templat per bahasa.
      if (isParameterKey(a.id)) {
        const options = parameterDefinition(a.id).options ?? [];
        const index = options.indexOf(a.option);
        const display =
          index >= 0 ? (parameterOptionLabels(a.id, locale)?.[index] ?? a.option) : a.option;
        return `${parameterLabel(a.id, locale)}: ${optionLabel(display, locale)}`;
      }
      const label = isIrrigationField(a.id)
        ? irrigationFieldLabel(a.id, locale)
        : (labels[a.id as RequirementFieldPath] ?? a.id);
      return `${label}: ${optionLabel(a.option, locale)}`;
    })
    .join(' · ');
}

function toQuestion(path: RequirementFieldPath, locale: Locale): ClarificationQuestion | null {
  const template = TEMPLATES[path];
  if (!template) return null;
  return {
    id: path,
    question: locale === 'en' ? (QUESTION_EN[path] ?? template.question) : template.question,
    options: template.options,
    ...(locale === 'en'
      ? { optionLabels: template.options.map((option) => optionLabel(option, locale)) }
      : {}),
    allowUnknown: true, // "Belum tahu" selalu tersedia — pengguna tidak dipaksa menebak.
  };
}
