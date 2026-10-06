/**
 * Jalur IRIGASI — fungsi murni, tanpa LLM. docs/CONTEXT_ENGINE.md · OQ-47.
 *
 * Keputusan pemilik (2026-10-06): irigasi sawah dilayani dengan ALUR yang sama seperti rumah —
 * kumpulkan kebutuhan lewat kartu klarifikasi, beri arahan, lanjut ke langkah berikutnya —
 * tetapi langkah berikutnya BUKAN sizing otomatis: aturan teknik irigasi (debit per hektar,
 * tekanan, panjang jalur) belum ada dari Pralon, dan angka yang tidak ada aturannya tidak
 * boleh dikarang. Jadi muaranya handoff terstruktur ke tim teknis, dengan data yang sudah rapi.
 *
 * Nilai disimpan sebagai LABEL yang dipilih/disebut pengguna, bukan enum: tidak ada mesin yang
 * membacanya selain manusia di tim teknis, dan label lebih jujur daripada enum yang dipaksakan.
 */
import type {
  ClarificationQuestion,
  IrrigationField,
  KeyValue,
  RequirementState,
} from '@snouty/shared-types';

export const UNKNOWN = 'Belum tahu';

/** Isyarat bahwa pesan adalah soal irigasi/pertanian. */
export const IRRIGATION_SIGNALS = /\b(irigasi|sawah|kebun|perkebunan|pertanian|ladang)\b/i;

interface IrrigationTemplate {
  readonly label: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly required: boolean;
}

/** Urutan = prioritas bertanya: yang paling menentukan arah lebih dulu. */
export const IRRIGATION_TEMPLATES: Readonly<Record<IrrigationField, IrrigationTemplate>> = {
  'irrigation.source': {
    label: 'Sumber air',
    question: 'Sumber airnya dari mana?',
    options: ['Sungai / saluran', 'Sumur / pompa', 'Embung / kolam', 'PDAM'],
    required: true,
  },
  'irrigation.areaHa': {
    label: 'Luas lahan',
    question: 'Luas lahannya kira-kira berapa?',
    options: ['Di bawah 0,5 ha', '0,5–1 ha', '1–2 ha', 'Di atas 2 ha'],
    required: true,
  },
  'irrigation.method': {
    label: 'Jenis irigasi',
    question: 'Jenis irigasinya?',
    options: ['Genangan / gravitasi', 'Sprinkler', 'Tetes'],
    required: true,
  },
  'irrigation.distance': {
    label: 'Jarak sumber ke lahan',
    question: 'Jarak dari sumber air ke lahan?',
    options: ['Di bawah 50 m', '50–200 m', '200–500 m', 'Di atas 500 m'],
    required: true,
  },
  'irrigation.elevation': {
    label: 'Beda tinggi',
    question: 'Posisi sumber air terhadap lahan?',
    options: ['Lebih rendah', 'Sejajar', 'Lebih tinggi'],
    required: true,
  },
  'irrigation.pump': {
    label: 'Pompa',
    question: 'Pakai pompa?',
    options: ['Ya', 'Tidak'],
    required: false,
  },
};

export const IRRIGATION_FIELDS = Object.keys(IRRIGATION_TEMPLATES) as readonly IrrigationField[];
const MAX_QUESTIONS = 4;

export function isIrrigationField(id: string): id is IrrigationField {
  return id in IRRIGATION_TEMPLATES;
}

export function isIrrigationMessage(message: string): boolean {
  return IRRIGATION_SIGNALS.test(message);
}

/**
 * Fakta yang TERSURAT di pesan — "1 hektar", "pakai pompa", "dari sungai", "irigasi tetes",
 * "jaraknya 300 meter". Hanya yang bentuknya tidak bisa salah baca; sisanya ditanya.
 */
export function irrigationFactsFrom(message: string): Partial<Record<IrrigationField, string>> {
  const m = message.toLowerCase();
  const facts: Partial<Record<IrrigationField, string>> = {};

  const area = /(\d+(?:[.,]\d+)?)\s*(?:ha|hektar|hektare)\b/.exec(m);
  if (area) facts['irrigation.areaHa'] = `${area[1]!.replace('.', ',')} ha`;

  if (/\b(sungai|kali|saluran|parit)\b/.test(m)) facts['irrigation.source'] = 'Sungai / saluran';
  else if (/\b(sumur|bor|air tanah)\b/.test(m)) facts['irrigation.source'] = 'Sumur / pompa';
  else if (/\b(embung|kolam|waduk|danau|tandon)\b/.test(m))
    facts['irrigation.source'] = 'Embung / kolam';
  else if (/\bpdam\b/.test(m)) facts['irrigation.source'] = 'PDAM';

  if (/\btetes\b|drip/.test(m)) facts['irrigation.method'] = 'Tetes';
  else if (/sprinkler|springkel|curah/.test(m)) facts['irrigation.method'] = 'Sprinkler';
  else if (/genang|gravitasi|alirkan/.test(m)) facts['irrigation.method'] = 'Genangan / gravitasi';

  const distance = /(\d+(?:[.,]\d+)?)\s*(km|m|meter)\b/.exec(m);
  if (distance) {
    const meters = Number(distance[1]!.replace(',', '.')) * (distance[2] === 'km' ? 1000 : 1);
    facts['irrigation.distance'] =
      meters < 50
        ? 'Di bawah 50 m'
        : meters <= 200
          ? '50–200 m'
          : meters <= 500
            ? '200–500 m'
            : 'Di atas 500 m';
  }

  if (/lebih tinggi|di atas lahan|dari atas/.test(m))
    facts['irrigation.elevation'] = 'Lebih tinggi';
  else if (/lebih rendah|di bawah lahan|dari bawah|naik ke/.test(m))
    facts['irrigation.elevation'] = 'Lebih rendah';

  if (/\bpompa\b/.test(m)) facts['irrigation.pump'] = 'Ya';
  return facts;
}

/** Jawaban (chip atau fakta tersurat) digabung ke state; yang sudah ada tidak ditimpa `Belum tahu`. */
export function applyIrrigationAnswers(
  state: RequirementState,
  answers: Readonly<Partial<Record<IrrigationField, string>>>,
): { readonly state: RequirementState; readonly changed: boolean } {
  const current = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  const next: Partial<Record<IrrigationField, string>> = { ...current };
  let changed = state.useCase === undefined;
  for (const [field, value] of Object.entries(answers) as [IrrigationField, string][]) {
    if (value === undefined || value === '') continue;
    if (value === UNKNOWN && next[field] !== undefined) continue;
    if (next[field] === value) continue;
    next[field] = value;
    changed = true;
  }
  return { state: { ...state, useCase: { kind: 'irrigation', answers: next } }, changed };
}

export function irrigationMissing(state: RequirementState): readonly IrrigationField[] {
  const answers = state.useCase?.kind === 'irrigation' ? state.useCase.answers : {};
  return IRRIGATION_FIELDS.filter(
    (f) => IRRIGATION_TEMPLATES[f].required && answers[f] === undefined,
  );
}

export function isIrrigationComplete(state: RequirementState): boolean {
  return state.useCase?.kind === 'irrigation' && irrigationMissing(state).length === 0;
}

/** Kartu klarifikasi irigasi: maksimum empat, urutan prioritas, selalu ada "Belum tahu". */
export function planIrrigationClarification(
  state: RequirementState,
): readonly ClarificationQuestion[] {
  return irrigationMissing(state)
    .slice(0, MAX_QUESTIONS)
    .map((id) => ({
      id,
      question: IRRIGATION_TEMPLATES[id].question,
      options: IRRIGATION_TEMPLATES[id].options,
      allowUnknown: true,
    }));
}

/** Label pilihan yang sah untuk sebuah pertanyaan irigasi (atau "Belum tahu"); lainnya `null`. */
export function irrigationAnswerValue(id: IrrigationField, option: string): string | null {
  if (option === UNKNOWN) return UNKNOWN;
  return IRRIGATION_TEMPLATES[id].options.includes(option) ? option : null;
}

/** Baris "yang sudah saya catat" untuk kartu handoff dan antrean tim teknis. */
export function irrigationCaptured(state: RequirementState): readonly KeyValue[] {
  if (state.useCase?.kind !== 'irrigation') return [];
  const answers = state.useCase.answers;
  return IRRIGATION_FIELDS.filter((f) => answers[f] !== undefined).map((f) => ({
    label: IRRIGATION_TEMPLATES[f].label,
    value: answers[f]!,
  }));
}
