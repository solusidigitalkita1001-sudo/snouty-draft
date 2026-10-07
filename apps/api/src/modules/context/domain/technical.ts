/**
 * Jalur KASUS TEKNIS UMUM — fungsi murni, tanpa LLM (Fase 14, brief asisten teknik umum §2–§9).
 *
 * Kasus yang bukan rumah tinggal dan bukan irigasi (keduanya punya jalurnya sendiri): transfer
 * pompa, saluran gravitasi, air hujan, gorong-gorong, sumur, cluster, gedung bertingkat.
 * Alurnya sama seperti dua jalur itu — fakta tersurat dicatat, yang kurang ditanya dengan
 * redaksi bahasa pengguna, maksimum empat — tetapi kosakatanya parameter universal dari
 * `packages/engineering`, sehingga kalkulator fase 3–4 bisa langsung membacanya.
 *
 * Sampai kalkulator sebuah kasus tersedia, muaranya validasi teknis terstruktur: data yang sudah
 * rapi diteruskan ke tim teknis, bukan angka yang dikarang.
 */
import {
  caseProfile,
  classifyCase,
  extractTechnicalContext,
  isCaseId,
  isParameterKey,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
  resolveMissingParameters,
  type CaseId,
  type MissingParameter,
  type ParameterKey,
} from '@snouty/engineering';
import {
  DEFAULT_LOCALE,
  type ClarificationQuestion,
  type KeyValue,
  type Locale,
  type RequirementState,
  type TechnicalParameter,
  type TechnicalUseCase,
} from '@snouty/shared-types';

export const UNKNOWN = 'Belum tahu';

/** Kasus yang dilayani jalur lain — klasifikasi ke sini tidak membuka jalur teknis. */
const OWN_TRACK: readonly CaseId[] = ['residential_clean_water', 'irrigation'];
const MIN_CONFIDENCE = 0.5;

/**
 * Kasus teknis untuk giliran ini: lanjutan percakapan teknis yang sudah berjalan, atau
 * klasifikasi pesan baru yang cukup yakin. `null` = bukan jalur ini.
 */
export function detectTechnicalCase(message: string, state: RequirementState): CaseId | null {
  if (state.useCase?.kind === 'technical' && isCaseId(state.useCase.caseId)) {
    return state.useCase.caseId;
  }
  const c = classifyCase(message);
  if (c.primary === null || OWN_TRACK.includes(c.primary) || c.confidence < MIN_CONFIDENCE) {
    return null;
  }
  return c.primary;
}

function parametersOf(state: RequirementState): Readonly<Record<string, TechnicalParameter>> {
  return state.useCase?.kind === 'technical' ? state.useCase.parameters : {};
}

function withParameters(
  state: RequirementState,
  caseId: CaseId,
  parameters: Readonly<Record<string, TechnicalParameter>>,
): RequirementState {
  const useCase: TechnicalUseCase = { kind: 'technical', caseId, parameters };
  return { ...state, useCase };
}

/** Fakta tersurat di pesan dicatat sebagai `known`; pernyataan terbaru pengguna menang. */
export function applyTechnicalFacts(
  state: RequirementState,
  caseId: CaseId,
  message: string,
): {
  readonly state: RequirementState;
  readonly changed: boolean;
  readonly captured: readonly ParameterKey[];
} {
  const facts = extractTechnicalContext(message, caseId);
  const next: Record<string, TechnicalParameter> = { ...parametersOf(state) };
  let changed = state.useCase?.kind !== 'technical' || state.useCase.caseId !== caseId;
  const captured: ParameterKey[] = [];
  for (const fact of facts) {
    const current = next[fact.key];
    if (current && current.origin === 'known' && current.value === fact.value) continue;
    next[fact.key] = {
      label: parameterDefinition(fact.key).label,
      value: fact.value,
      ...(fact.unit ? { unit: fact.unit } : {}),
      origin: 'known',
      evidence: fact.evidence,
    };
    captured.push(fact.key);
    changed = true;
  }
  return { state: withParameters(state, caseId, next), changed, captured };
}

/** Jawaban kartu/klarifikasi: `UNKNOWN` tercatat sebagai `assumed` supaya tidak ditanya lagi. */
export function applyTechnicalAnswers(
  state: RequirementState,
  answers: ReadonlyArray<{ readonly key: ParameterKey; readonly value: number | string | boolean }>,
): { readonly state: RequirementState; readonly changed: boolean } {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) {
    return { state, changed: false };
  }
  const next: Record<string, TechnicalParameter> = { ...state.useCase.parameters };
  let changed = false;
  for (const answer of answers) {
    const current = next[answer.key];
    if (answer.value === UNKNOWN && current !== undefined) continue;
    if (current?.value === answer.value) continue;
    const def = parameterDefinition(answer.key);
    next[answer.key] = {
      label: def.label,
      value: answer.value,
      ...(def.unit && typeof answer.value === 'number' ? { unit: def.unit } : {}),
      origin: answer.value === UNKNOWN ? 'assumed' : 'known',
    };
    changed = true;
  }
  return { state: withParameters(state, state.useCase.caseId, next), changed };
}

/** Nilai sah untuk jawaban sebuah parameter dari label pilihan; `null` bila tidak dikenali. */
export function technicalAnswerValue(
  key: string,
  option: string,
): { readonly key: ParameterKey; readonly value: number | string | boolean } | null {
  if (!isParameterKey(key)) return null;
  if (option === UNKNOWN) return { key, value: UNKNOWN };
  const def = parameterDefinition(key);
  if (def.kind === 'boolean') {
    if (/^(ya|yes)$/i.test(option)) return { key, value: true };
    if (/^(tidak|no)$/i.test(option)) return { key, value: false };
    return null;
  }
  if (def.kind === 'number') {
    const n = Number(option.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? { key, value: n } : null;
  }
  if (def.kind === 'enum') {
    // Klien mengirim nilai protokol (Indonesia); label Inggris diterima juga agar jawaban yang
    // diketik ulang dalam bahasa percakapan tetap terpetakan ke nilai kanoniknya.
    const options = def.options ?? [];
    const english = parameterOptionLabels(key, 'en') ?? [];
    const index = options.findIndex(
      (o, i) =>
        normalize(o) === normalize(option) ||
        (english[i] !== undefined && normalize(english[i]) === normalize(option)),
    );
    return index >= 0 ? { key, value: options[index]! } : null;
  }
  return option.trim() ? { key, value: option.trim() } : null;
}

function normalize(label: string): string {
  return label
    .toLowerCase()
    .replace(/[–—‒−-]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function sets(state: RequirementState): { known: Set<string>; assumed: Set<string> } {
  const known = new Set<string>();
  const assumed = new Set<string>();
  for (const [key, p] of Object.entries(parametersOf(state))) {
    (p.origin === 'known' ? known : assumed).add(key);
  }
  return { known, assumed };
}

/** Parameter yang masih perlu ditanya, urut dampak — maksimum empat (brief §8). */
export function technicalMissing(state: RequirementState): readonly MissingParameter[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  return resolveMissingParameters({ profile, ...sets(state) });
}

/** Lengkap = tidak ada parameter KRITIS yang masih belum diketahui/diasumsikan. */
export function isTechnicalComplete(state: RequirementState): boolean {
  return (
    state.useCase?.kind === 'technical' &&
    !technicalMissing(state).some((m) => m.importance === 'critical')
  );
}

/**
 * Pertanyaan berpilihan (enum/boolean) menjadi kartu klarifikasi; pertanyaan angka ditanya di
 * teks — pengguna menjawabnya dengan kalimat biasa dan ekstraktor membacanya.
 */
export function planTechnicalClarification(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): {
  readonly card: readonly ClarificationQuestion[];
  readonly text: readonly MissingParameter[];
} {
  const card: ClarificationQuestion[] = [];
  const text: MissingParameter[] = [];
  for (const m of technicalMissing(state)) {
    const def = parameterDefinition(m.key);
    const question = locale === 'en' ? m.questionEn : m.question;
    if (def.kind === 'enum' && def.options) {
      // `options` tetap nilai protokol Indonesia; label tampilannya mengikuti bahasa percakapan.
      const optionLabels = parameterOptionLabels(m.key, locale);
      card.push({
        id: m.key,
        question,
        options: def.options,
        ...(locale === 'en' && optionLabels ? { optionLabels } : {}),
        allowUnknown: true,
      });
    } else if (def.kind === 'boolean') {
      card.push({
        id: m.key,
        question,
        options: ['Ya', 'Tidak'],
        ...(locale === 'en' ? { optionLabels: ['Yes', 'No'] } : {}),
        allowUnknown: true,
      });
    } else {
      text.push(m);
    }
  }
  return { card, text };
}

/**
 * Label parameter dalam bahasa percakapan. Label yang tersimpan di state selalu Indonesia
 * (ditulis saat fakta dicatat); bahasa dipilih saat ditampilkan, bukan saat disimpan, supaya
 * percakapan yang berganti bahasa tidak membawa label campuran.
 */
export function technicalParameterLabel(
  key: string,
  p: TechnicalParameter,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return isParameterKey(key) ? parameterLabel(key, locale) : p.label;
}

/**
 * Nilai parameter untuk ditampilkan. Nilai enum tersimpan sebagai nilai protokol Indonesia
 * ("Sumur"); bila `key` diberikan, bahasa Inggris memakai label pilihan dari registry ("Well").
 */
export function formatTechnicalValue(
  p: TechnicalParameter,
  locale: Locale = DEFAULT_LOCALE,
  key?: string,
): string {
  if (typeof p.value === 'boolean') {
    return locale === 'en' ? (p.value ? 'Yes' : 'No') : p.value ? 'Ya' : 'Tidak';
  }
  if (typeof p.value === 'number') {
    const n = p.value.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', {
      maximumFractionDigits: 2,
    });
    return p.unit ? `${n} ${p.unit}` : n;
  }
  if (locale === 'en' && key !== undefined && isParameterKey(key)) {
    const options = parameterDefinition(key).options ?? [];
    const labels = parameterOptionLabels(key, locale) ?? [];
    const index = options.indexOf(p.value);
    if (index >= 0 && labels[index] !== undefined) return labels[index];
  }
  return p.value;
}

/** Baris "yang sudah saya catat" untuk kartu validasi teknis dan panel. */
export function technicalCaptured(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): readonly KeyValue[] {
  return Object.entries(parametersOf(state))
    .filter(([, p]) => p.value !== UNKNOWN)
    .map(([key, p]) => ({
      label: technicalParameterLabel(key, p, locale),
      value: formatTechnicalValue(p, locale, key),
    }));
}

/**
 * Balasan giliran: nama kasus, data yang diketahui, dan — bila masih kurang — pertanyaan dalam
 * bahasa pengguna. Tanpa angka teknik: belum ada yang dihitung di tahap ini.
 */
export function technicalGuidance(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
  /** `withIntro: false` untuk giliran lanjutan (jawaban kartu): kasusnya sudah disebut sebelumnya. */
  options: { readonly withIntro?: boolean } = {},
): string {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return '';
  const profile = caseProfile(state.useCase.caseId);
  const known = technicalCaptured(state, locale);
  const copy = GUIDANCE_COPY[locale];
  // Redaksi seperti teknisi yang membalas sendiri: tanpa judul bagian, tanpa penomoran, tanpa
  // kalimat tentang "data"/"asumsi" sebagai konsep — cukup apa yang dicatat dan apa yang ditanya.
  const lines: string[] =
    options.withIntro === false ? [] : [(locale === 'en' ? INTRO_EN : INTRO)[state.useCase.caseId]];
  if (known.length > 0) {
    lines.push(
      '',
      copy.captured(
        joinNatural(
          known.map((r) => `${r.label.toLowerCase()} ${r.value}`),
          locale,
        ),
      ),
    );
  }
  const { text, card } = planTechnicalClarification(state, locale);
  const missing = [
    ...text.map((m) => (locale === 'en' ? m.questionEn : m.question)),
    ...card.map((q) => q.question),
  ];
  if (missing.length > 0) {
    lines.push('', copy.askIntro);
    for (const question of missing) lines.push(`- ${question}`);
    if (isTechnicalComplete(state) && profile.calculatorStatus === 'available') {
      lines.push('', copy.proceedWithDefaults);
    }
  } else if (profile.calculatorStatus === 'available') {
    lines.push('', copy.readyToCompute);
  } else {
    lines.push('', copy.readyForTeam);
  }
  // Tanpa pembuka, baris kosong pemisah pertama tidak diperlukan.
  return lines.join('\n').replace(/^\n+/, '');
}

interface GuidanceCopy {
  readonly captured: (joined: string) => string;
  readonly askIntro: string;
  readonly proceedWithDefaults: string;
  readonly readyToCompute: string;
  readonly readyForTeam: string;
}

const GUIDANCE_COPY: Readonly<Record<Locale, GuidanceCopy>> = {
  id: {
    captured: (joined) => `Yang sudah saya catat: ${joined}.`,
    askIntro: 'Supaya hitungannya pas, tolong jawab beberapa hal ini:',
    proceedWithDefaults:
      'Kalau mau langsung lihat hasilnya, tekan **Susun rekomendasi** — yang belum disebut saya pakai angka perkiraan awal dan saya tandai jelas di hasilnya.',
    readyToCompute:
      'Datanya sudah cukup. Tekan **Susun rekomendasi** untuk melihat ukuran pipa dan daftar produknya.',
    readyForTeam:
      'Datanya sudah cukup; saya teruskan ke tim teknis Pralon untuk dihitung, dan hasilnya dikirim ke Anda.',
  },
  en: {
    captured: (joined) => `What I have noted so far: ${joined}.`,
    askIntro: 'So the calculation fits, please answer a few things:',
    proceedWithDefaults:
      'If you want to see the result right away, press **Compose recommendation** — anything not mentioned uses an initial estimate that I mark clearly in the result.',
    readyToCompute:
      'That is enough data. Press **Compose recommendation** to see the pipe sizes and the product list.',
    readyForTeam:
      'That is enough data; I will pass it to the Pralon technical team to calculate, and the result will be sent to you.',
  },
};

/** Kalimat pembuka per kasus — apa yang akan dihitung, dalam bahasa teknisi, bukan deskripsi profil. */
const INTRO: Readonly<Record<CaseId, string>> = {
  residential_clean_water:
    'Oke, air bersih rumah. Saya hitung ukuran pipa utama, cabang, dan sambungan fixture-nya.',
  multistorey_building_water:
    'Oke, gedung bertingkat. Saya hitung riser, zonasi tekanan, dan kebutuhan pompanya.',
  residential_cluster:
    'Oke, jaringan cluster. Saya hitung kebutuhan puncak dan ukuran pipa distribusinya.',
  irrigation: 'Oke, irigasi. Saya hitung debit, jalur utama, distribusi, dan pompanya.',
  pump_transfer:
    'Oke, transfer air dengan pompa. Saya hitung ukuran pipa, kerugian tekanan, dan titik kerja pompanya.',
  gravity_drainage: 'Oke, saluran gravitasi. Saya hitung diameter dan kemiringan pipanya.',
  stormwater: 'Oke, drainase air hujan. Saya hitung debit limpasan dan ukuran pipanya.',
  culvert:
    'Oke, gorong-gorong. Saya hitung diameter dan kelas pipanya dari debit, kemiringan, dan beban jalan.',
  well_distribution: 'Oke, sumur ke tandon. Saya hitung pipa dan kebutuhan pompanya.',
  fish_pond: 'Oke, kolam/tambak. Saya hitung pipa masuk, pipa kuras, dan fitting-nya.',
};

/** Kalimat pembuka per kasus (Inggris) — kunci sama dengan `INTRO`. */
const INTRO_EN: Readonly<Record<CaseId, string>> = {
  residential_clean_water:
    "Okay, clean water for a house. I'll size the main pipe, the branches, and the fixture connections.",
  multistorey_building_water:
    "Okay, a multi-storey building. I'll work out the risers, pressure zoning, and pump needs.",
  residential_cluster:
    "Okay, a cluster network. I'll work out the peak demand and the distribution pipe sizes.",
  irrigation: "Okay, irrigation. I'll work out the flow, main line, distribution, and the pump.",
  pump_transfer:
    "Okay, pumped water transfer. I'll work out the pipe size, pressure losses, and the pump duty point.",
  gravity_drainage: "Okay, a gravity drain. I'll work out the pipe diameter and slope.",
  stormwater: "Okay, stormwater drainage. I'll work out the runoff flow and the pipe size.",
  culvert:
    "Okay, a culvert. I'll work out the diameter and pipe class from the flow, slope, and road load.",
  well_distribution: "Okay, well to storage tank. I'll work out the pipe and the pump needs.",
  fish_pond: "Okay, a fish pond. I'll work out the inlet pipe, the drain pipe, and the fittings.",
};

function joinNatural(items: readonly string[], locale: Locale = DEFAULT_LOCALE): string {
  if (items.length <= 1) return items.join('');
  const and = locale === 'en' ? 'and' : 'dan';
  return `${items.slice(0, -1).join(', ')}, ${and} ${items[items.length - 1]}`;
}
