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
import {
  DEFAULT_LOCALE,
  type ClarificationQuestion,
  type IrrigationField,
  type KeyValue,
  type Locale,
  type RequirementState,
} from '@snouty/shared-types';

export const UNKNOWN = 'Belum tahu';

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

/** Redaksi Inggris sebuah field; `optionLabels` sejajar dengan `options` templat Indonesia. */
interface IrrigationTemplateEn {
  readonly label: string;
  readonly question: string;
  readonly optionLabels: readonly string[];
}

/** Kembaran Inggris `IRRIGATION_TEMPLATES` — kunci sama; `options` (protokol) tetap Indonesia. */
export const IRRIGATION_TEMPLATES_EN: Readonly<Record<IrrigationField, IrrigationTemplateEn>> = {
  'irrigation.source': {
    label: 'Water source',
    question: 'Where does the water come from?',
    optionLabels: ['River / canal', 'Well / pump', 'Reservoir / pond', 'Municipal water (PDAM)'],
  },
  'irrigation.areaHa': {
    label: 'Land area',
    question: 'Roughly how large is the land?',
    optionLabels: ['Under 0.5 ha', '0.5–1 ha', '1–2 ha', 'Over 2 ha'],
  },
  'irrigation.method': {
    label: 'Irrigation type',
    question: 'What type of irrigation?',
    optionLabels: ['Flood / gravity', 'Sprinkler', 'Drip'],
  },
  'irrigation.distance': {
    label: 'Distance from source to land',
    question: 'How far is the water source from the land?',
    optionLabels: ['Under 50 m', '50–200 m', '200–500 m', 'Over 500 m'],
  },
  'irrigation.elevation': {
    label: 'Height difference',
    question: 'Where is the water source relative to the land?',
    optionLabels: ['Lower', 'Level', 'Higher'],
  },
  'irrigation.pump': {
    label: 'Pump',
    question: 'Will a pump be used?',
    optionLabels: ['Yes', 'No'],
  },
};

/** Label field menurut bahasa percakapan. */
export function irrigationFieldLabel(
  field: IrrigationField,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return locale === 'en' ? IRRIGATION_TEMPLATES_EN[field].label : IRRIGATION_TEMPLATES[field].label;
}

export const IRRIGATION_FIELDS = Object.keys(IRRIGATION_TEMPLATES) as readonly IrrigationField[];
const MAX_QUESTIONS = 4;

export function isIrrigationField(id: string): id is IrrigationField {
  return id in IRRIGATION_TEMPLATES;
}

/**
 * Fakta yang TERSURAT di pesan — "1 hektar", "pakai pompa", "dari sungai", "irigasi tetes",
 * "jaraknya 300 meter". Hanya yang bentuknya tidak bisa salah baca; sisanya ditanya.
 */
export function irrigationFactsFrom(message: string): Partial<Record<IrrigationField, string>> {
  const m = message.toLowerCase();
  const facts: Partial<Record<IrrigationField, string>> = {};

  // Dua bahasa (Fase 15): kalimat Inggris dibaca dengan pola yang sama; nilai yang disimpan tetap
  // label pilihan protokol Indonesia.
  const area = /(\d+(?:[.,]\d+)?)\s*(?:ha|hektar|hektare|hectares?)\b/.exec(m);
  if (area) facts['irrigation.areaHa'] = `${area[1]!.replace('.', ',')} ha`;

  if (/\b(sungai|kali|saluran|parit|river|creek|stream|canal|ditch)\b/.test(m))
    facts['irrigation.source'] = 'Sungai / saluran';
  else if (/\b(sumur|bor|air tanah|well|borehole|groundwater)\b/.test(m))
    facts['irrigation.source'] = 'Sumur / pompa';
  else if (/\b(embung|kolam|waduk|danau|tandon|pond|reservoir|lake|dam)\b/.test(m))
    facts['irrigation.source'] = 'Embung / kolam';
  else if (/\b(pdam|municipal|mains)\b/.test(m)) facts['irrigation.source'] = 'PDAM';

  if (/\btetes\b|drip|trickle/.test(m)) facts['irrigation.method'] = 'Tetes';
  else if (/sprinkler|springkel|curah/.test(m)) facts['irrigation.method'] = 'Sprinkler';
  else if (/genang|gravitasi|alirkan|flood|furrow|gravity/.test(m))
    facts['irrigation.method'] = 'Genangan / gravitasi';

  const distance = /(\d+(?:[.,]\d+)?)\s*(km|m|meter|meters|metres|kilometers?|kilometres?)\b/.exec(
    m,
  );
  if (distance) {
    const unit = distance[2]!;
    const meters = Number(distance[1]!.replace(',', '.')) * (unit.startsWith('k') ? 1000 : 1);
    facts['irrigation.distance'] =
      meters < 50
        ? 'Di bawah 50 m'
        : meters <= 200
          ? '50–200 m'
          : meters <= 500
            ? '200–500 m'
            : 'Di atas 500 m';
  }

  if (
    /lebih tinggi|di atas lahan|dari atas|higher than|above the field|uphill|downhill to the field/.test(
      m,
    )
  )
    facts['irrigation.elevation'] = 'Lebih tinggi';
  else if (
    /lebih rendah|di bawah lahan|dari bawah|naik ke|lower than|below the field|uphill to the field/.test(
      m,
    )
  )
    facts['irrigation.elevation'] = 'Lebih rendah';

  if (/\b(pompa|pump|pumped|pumping)\b/.test(m)) facts['irrigation.pump'] = 'Ya';
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
  locale: Locale = DEFAULT_LOCALE,
): readonly ClarificationQuestion[] {
  return irrigationMissing(state)
    .slice(0, MAX_QUESTIONS)
    .map((id): ClarificationQuestion => {
      // `options` selalu nilai protokol Indonesia; bahasa lain hanya mengubah tampilan.
      if (locale === 'en') {
        const en = IRRIGATION_TEMPLATES_EN[id];
        return {
          id,
          question: en.question,
          options: IRRIGATION_TEMPLATES[id].options,
          optionLabels: en.optionLabels,
          allowUnknown: true,
        };
      }
      return {
        id,
        question: IRRIGATION_TEMPLATES[id].question,
        options: IRRIGATION_TEMPLATES[id].options,
        allowUnknown: true,
      };
    });
}

/** Label pilihan yang sah untuk sebuah pertanyaan irigasi (atau "Belum tahu"); lainnya `null`. */
export function irrigationAnswerValue(id: IrrigationField, option: string): string | null {
  if (option === UNKNOWN) return UNKNOWN;
  // Tanda pisah (– — -) dan spasi disamakan: label kanonik templat yang disimpan, bukan
  // ejaan klien — "200-500 m" dari keyboard biasa tetap cocok dengan "200–500 m".
  const canonical = IRRIGATION_TEMPLATES[id].options.find(
    (candidate) => normalizeLabel(candidate) === normalizeLabel(option),
  );
  return canonical ?? null;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[–—‒−-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Baris "yang sudah saya catat" untuk kartu handoff dan antrean tim teknis. */
export function irrigationCaptured(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  if (state.useCase?.kind !== 'irrigation') return [];
  const answers = state.useCase.answers;
  return IRRIGATION_FIELDS.filter((f) => answers[f] !== undefined).map((f) => ({
    label: irrigationFieldLabel(f, locale),
    value: answers[f]!,
  }));
}
