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

import { MAX_QUESTIONS as MAX_TECHNICAL_QUESTIONS } from '@snouty/engineering';
import type { ClarificationQuestion, Dimensions, RequirementFieldPath } from '@snouty/shared-types';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type { FieldUpdate } from './context-merger.js';
import {
  isParameterKey,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
} from '@snouty/engineering';
import { irrigationFieldLabel, isIrrigationField } from './irrigation.js';
import { FLOOR_HEIGHT_RANGE_M } from './completeness.js';

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
  /** Isian angka bebas sebagai pengganti atau pelengkap pilihan (ukuran, tinggi lantai, jumlah). */
  readonly inputs?: readonly TemplateInput[];
  /** Bentuk nilai isian: objek ukuran (bawaan) atau satu angka (`value=…`). */
  readonly inputValue?: 'dimensions' | 'number';
}

interface TemplateInput {
  readonly key: string;
  readonly unit?: string;
  readonly group: { readonly id: string; readonly en: string };
  readonly label: { readonly id: string; readonly en: string };
  readonly required: boolean;
  readonly min: number;
  readonly max: number;
}

/**
 * Ukuran diisi sendiri, bangunan dan tanah terpisah (permintaan pemilik 2026-10-12). Bangunan
 * wajib dan dipakai menghitung; tanah boleh dikosongkan dan hanya dicatat.
 */
/**
 * Tinggi tiap lantai diisi angka (TC-H-02): rentangnya sama dengan pagar engine ENG-702 dan skema
 * ekstraksi (2–10 m). Ditanyakan bila nilai yang disebut di luar rentang itu.
 */
const FLOOR_HEIGHT_INPUTS: readonly TemplateInput[] = [
  {
    key: 'value',
    unit: 'm',
    group: { id: 'Tinggi tiap lantai', en: 'Floor height' },
    label: { id: 'Tinggi', en: 'Height' },
    required: true,
    min: FLOOR_HEIGHT_RANGE_M.min,
    max: FLOOR_HEIGHT_RANGE_M.max,
  },
];

/**
 * Kedalaman muka air sumur (review putaran 3, 1b): pilihan rentang, atau angka pastinya. Rentang
 * dihitung dengan batas atasnya supaya tinggi angkat pompa tidak kurang (OQ-66).
 */
const WELL_DEPTH_INPUTS: readonly TemplateInput[] = [
  {
    key: 'value',
    unit: 'm',
    group: { id: 'Angka pasti', en: 'Exact depth' },
    label: { id: 'Kedalaman', en: 'Depth' },
    required: true,
    min: 0,
    max: 60,
  },
];

/** Jumlah di atas pilihan yang tersedia diketik sendiri (TC-H-04: 8 wastafel / keran wudhu). */
const countInputs = (more: { id: string; en: string }): readonly TemplateInput[] => [
  {
    key: 'value',
    unit: '',
    group: more,
    label: { id: 'Jumlah', en: 'Number' },
    required: true,
    min: 0,
    max: 500,
  },
];

const DIMENSION_INPUTS: readonly TemplateInput[] = [
  {
    key: 'lengthM',
    group: { id: 'Bangunan', en: 'Building' },
    label: { id: 'Panjang', en: 'Length' },
    required: true,
    min: 2,
    max: 200,
  },
  {
    key: 'widthM',
    group: { id: 'Bangunan', en: 'Building' },
    label: { id: 'Lebar', en: 'Width' },
    required: true,
    min: 2,
    max: 200,
  },
  {
    key: 'landLengthM',
    group: { id: 'Tanah', en: 'Land' },
    label: { id: 'Panjang', en: 'Length' },
    required: false,
    min: 2,
    max: 1000,
  },
  {
    key: 'landWidthM',
    group: { id: 'Tanah', en: 'Land' },
    label: { id: 'Lebar', en: 'Width' },
    required: false,
    min: 2,
    max: 1000,
  },
];

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
    inputs: countInputs({ id: 'Lebih dari 4', en: 'More than 4' }),
    inputValue: 'number',
  },
  // Pertanyaan penyempurna (koreksi 2026-10-12): ditanya di samping tombol Susun rekomendasi.
  'building.dimensions': {
    question: 'Berapa ukuran bangunan dan tanahnya (panjang × lebar)?',
    options: [],
    inputs: DIMENSION_INPUTS,
  },
  'fixtures.kitchens': {
    question: 'Ada berapa dapur?',
    options: ['0', '1', '2'],
  },
  'fixtures.basins': {
    question: 'Ada berapa wastafel di luar kamar mandi?',
    options: ['0', '1', '2', '3'],
    inputs: countInputs({ id: 'Lebih dari 3', en: 'More than 3' }),
    inputValue: 'number',
  },
  'building.floorHeightM': {
    question: 'Berapa tinggi tiap lantai (antara 2 dan 10 m)?',
    options: [],
    inputs: FLOOR_HEIGHT_INPUTS,
    inputValue: 'number',
  },
  // Tempat ibadah (2026-10-12): keran wudhu dihitung serentak, satu talang per tempat wudhu.
  'fixtures.wudhuTaps': {
    question: 'Ada berapa keran wudhu (semua tempat wudhu)?',
    options: ['4', '6', '8', '10'],
    inputs: countInputs({ id: 'Jumlah lain', en: 'Other number' }),
    inputValue: 'number',
  },
  'fixtures.wudhuAreas': {
    question: 'Keran wudhunya dibagi di berapa tempat?',
    options: ['1', '2', '3'],
    inputs: countInputs({ id: 'Lebih dari 3', en: 'More than 3' }),
    inputValue: 'number',
  },
  'water.wellDepthM': {
    question: 'Muka air sumurnya kira-kira berapa meter di bawah tanah?',
    options: ['< 5 m', '5–9 m', '> 9 m'],
    inputs: WELL_DEPTH_INPUTS,
    inputValue: 'number',
  },
  'fixtures.urinals': {
    question: 'Ada berapa urinoir di toilet pria?',
    options: ['0', '2', '3', '4'],
    inputs: countInputs({ id: 'Jumlah lain', en: 'Other number' }),
    inputValue: 'number',
  },
};

/** Field yang memperbaiki hitungan rumah setelah data inti lengkap, urut pengaruhnya. */
export const HOUSE_REFINEMENT_FIELDS: readonly RequirementFieldPath[] = [
  'building.dimensions',
  'fixtures.kitchens',
  'fixtures.basins',
];

/** Sekolah / klinik: toilet umum tanpa wudhu (pemilik 2026-10-12). */
export const PUBLIC_REFINEMENT_FIELDS: readonly RequirementFieldPath[] = [
  'building.dimensions',
  'fixtures.urinals',
  'fixtures.basins',
];

/** Tempat ibadah: wudhu dan urinoir menggantikan dapur (laporan pemilik 2026-10-12). */
export const WORSHIP_REFINEMENT_FIELDS: readonly RequirementFieldPath[] = [
  'building.dimensions',
  'fixtures.wudhuTaps',
  'fixtures.wudhuAreas',
  'fixtures.urinals',
  'fixtures.basins',
];

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
  'building.dimensions': 'What are the building and land sizes (length × width)?',
  'fixtures.kitchens': 'How many kitchens are there?',
  'fixtures.basins': 'How many wash basins outside the bathrooms?',
  'building.floorHeightM': 'What is the height of each floor (between 2 and 10 m)?',
  'fixtures.wudhuTaps': 'How many ablution taps are there (all ablution areas)?',
  'fixtures.wudhuAreas': 'How many ablution areas are the taps split over?',
  'fixtures.urinals': 'How many urinals are in the men’s restroom?',
  'water.wellDepthM': 'Roughly how many metres below the ground is the well water level?',
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
/**
 * Jumlah jawaban terbanyak dalam satu kartu yang bisa dikirim API: kartu inti, kartu penyempurna
 * rumah/tempat ibadah/sekolah, atau kartu kasus teknis. Batas endpoint jawaban diturunkan dari sini
 * — dulu literal 4 sementara kartu tempat ibadah berisi 5 pertanyaan, jadi jawabannya 400
 * (laporan pemilik 2026-10-12).
 */
export const MAX_ANSWERS_PER_CARD = Math.max(
  MAX_CLARIFICATION_QUESTIONS,
  // +1: kedalaman sumur ikut kartu penyempurna bila sumbernya sumur.
  HOUSE_REFINEMENT_FIELDS.length + 1,
  WORSHIP_REFINEMENT_FIELDS.length + 1,
  PUBLIC_REFINEMENT_FIELDS.length + 1,
  MAX_TECHNICAL_QUESTIONS,
);

/** Field inti yang kartunya bisa dijawab — sama dengan yang ditanyakan `planClarification`. */
const CORE_CLARIFICATION_IDS: ReadonlySet<string> = new Set<RequirementFieldPath>([
  'water.source',
  'water.installationType',
  'building.floors',
  'fixtures.bathrooms',
  'building.floorHeightM',
  ...HOUSE_REFINEMENT_FIELDS,
  ...WORSHIP_REFINEMENT_FIELDS,
  'water.wellDepthM',
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
  // Batas atas rentang (tinggi angkat tidak kurang); "> 9 m" dihitung 10 m — OQ-66.
  'water.wellDepthM': { '< 5 m': 5, '5–9 m': 9, '> 9 m': 10 },
};

/** Label singkat untuk ringkasan jawaban di gelembung pengguna. */
const ANSWER_LABEL: Readonly<Partial<Record<RequirementFieldPath, string>>> = {
  'water.source': 'Sumber air',
  'water.installationType': 'Instalasi',
  'building.floors': 'Lantai',
  'fixtures.bathrooms': 'Kamar mandi',
  'building.dimensions': 'Ukuran',
  'fixtures.kitchens': 'Dapur',
  'fixtures.basins': 'Wastafel',
  'building.floorHeightM': 'Tinggi tiap lantai',
  'fixtures.wudhuTaps': 'Keran wudhu',
  'fixtures.wudhuAreas': 'Tempat wudhu',
  'fixtures.urinals': 'Urinoir',
  'water.wellDepthM': 'Muka air sumur',
};
const ANSWER_LABEL_EN: Readonly<Partial<Record<RequirementFieldPath, string>>> = {
  'water.source': 'Water source',
  'water.installationType': 'Installation',
  'building.floors': 'Floors',
  'fixtures.bathrooms': 'Bathrooms',
  'building.dimensions': 'Size',
  'fixtures.kitchens': 'Kitchens',
  'fixtures.basins': 'Basins',
  'building.floorHeightM': 'Floor height',
  'fixtures.wudhuTaps': 'Ablution taps',
  'fixtures.wudhuAreas': 'Ablution areas',
  'fixtures.urinals': 'Urinals',
  'water.wellDepthM': 'Well water level',
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
  const template = TEMPLATES[path]!;
  if (template.inputs && answer.option.includes('=')) {
    const values = inputValues(answer.option, template.inputs);
    if (values === null) return null;
    const value = template.inputValue === 'number' ? values['value'] : values;
    return value === undefined ? null : { path, value, source: 'user_stated' };
  }
  if (!TEMPLATES[path]!.options.includes(answer.option)) return null;
  const mapped = OPTION_VALUES[path]?.[answer.option];
  const value = mapped ?? (/^\d+$/.test(answer.option) ? Number(answer.option) : null);
  if (value === null) return null;
  return { path, value, source: 'user_stated' };
}

/**
 * `"lengthM=8;widthM=12;landLengthM=10;landWidthM=20"` → nilai field — parser nilai terstruktur.
 * Kunci harus dari isian templat, angka dalam batasnya; kelompok diisi lengkap atau kosong
 * seluruhnya; kelompok wajib harus ada. Selain itu `null`, bukan tebakan.
 */
function inputValues(
  option: string,
  inputs: readonly TemplateInput[],
): Readonly<Record<string, number>> | null {
  const values: Record<string, number> = {};
  for (const part of option.split(';')) {
    const [key, raw] = part.split('=');
    const input = inputs.find((i) => i.key === key?.trim());
    const value = Number((raw ?? '').trim().replace(',', '.'));
    if (!input || raw === undefined || !Number.isFinite(value)) return null;
    if (value < input.min || value > input.max) return null;
    values[input.key] = value;
  }
  const groups = [...new Set(inputs.map((i) => i.group.id))];
  for (const group of groups) {
    const members = inputs.filter((i) => i.group.id === group);
    const filled = members.filter((i) => values[i.key] !== undefined).length;
    if (filled !== 0 && filled !== members.length) return null;
    if (filled === 0 && members.some((i) => i.required)) return null;
  }
  return values;
}

/** "8 × 12 m (bangunan) · 10 × 20 m (tanah)" — jawaban isian untuk gelembung pengguna. */
function inputSummary(template: QuestionTemplate, option: string, locale: Locale): string {
  const en = locale === 'en';
  const n = (x: number) => x.toLocaleString(en ? 'en-US' : 'id-ID', { maximumFractionDigits: 1 });
  if (template.inputValue === 'number') {
    const v = inputValues(option, template.inputs ?? [])?.['value'];
    const unit = template.inputs?.[0]?.unit;
    return v === undefined ? option : `${n(v)}${unit ? ` ${unit}` : ''}`;
  }
  const d = inputValues(option, DIMENSION_INPUTS) as Dimensions | null;
  if (d === null) return option;
  const parts = [`${en ? 'building' : 'bangunan'} ${n(d.lengthM!)} × ${n(d.widthM!)} m`];
  if (d.landLengthM !== undefined && d.landWidthM !== undefined)
    parts.push(`${en ? 'land' : 'tanah'} ${n(d.landLengthM)} × ${n(d.landWidthM)} m`);
  return parts.join(', ');
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
      const template = TEMPLATES[a.id as RequirementFieldPath];
      if (template?.inputs && a.option.includes('='))
        return `${label}: ${inputSummary(template, a.option, locale)}`;
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
    ...(template.inputs
      ? {
          inputs: template.inputs.map((input) => ({
            key: input.key,
            group: locale === 'en' ? input.group.en : input.group.id,
            label: locale === 'en' ? input.label.en : input.label.id,
            unit: input.unit ?? 'm',
            required: input.required,
            min: input.min,
            max: input.max,
          })),
        }
      : {}),
    ...(locale === 'en'
      ? { optionLabels: template.options.map((option) => optionLabel(option, locale)) }
      : {}),
    allowUnknown: true, // "Belum tahu" selalu tersedia — pengguna tidak dipaksa menebak.
  };
}

/**
 * Pertanyaan yang memperbaiki hitungan rumah, ditampilkan di samping tombol Susun rekomendasi
 * setelah data inti lengkap (laporan pemilik 2026-10-12: "kurang parameter luas"). Hanya field
 * yang belum disebut pengguna; "Belum tahu" membiarkan asumsinya berlaku.
 */
export function houseRefinementQuestions(
  isKnown: (path: RequirementFieldPath) => boolean,
  locale: Locale = DEFAULT_LOCALE,
  buildingType: string | null = null,
  waterSource: string | null = null,
): readonly ClarificationQuestion[] {
  const base =
    buildingType === 'place_of_worship'
      ? WORSHIP_REFINEMENT_FIELDS
      : buildingType === 'public_building'
        ? PUBLIC_REFINEMENT_FIELDS
        : HOUSE_REFINEMENT_FIELDS;
  // Sumur: kedalaman muka airnya menentukan tinggi angkat dan jenis pompa (review putaran 3, 1b).
  const fields: readonly RequirementFieldPath[] =
    waterSource === 'pump' ? [...base, 'water.wellDepthM'] : base;
  return fields
    .filter((path) => !isKnown(path))
    .map((path) => toQuestion(path, locale))
    .filter((q): q is ClarificationQuestion => q !== null);
}
