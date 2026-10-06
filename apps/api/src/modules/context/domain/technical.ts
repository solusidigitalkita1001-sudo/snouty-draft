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
  resolveMissingParameters,
  type CaseId,
  type MissingParameter,
  type ParameterKey,
} from '@snouty/engineering';
import type {
  ClarificationQuestion,
  KeyValue,
  RequirementState,
  TechnicalParameter,
  TechnicalUseCase,
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
    if (/^ya$/i.test(option)) return { key, value: true };
    if (/^tidak$/i.test(option)) return { key, value: false };
    return null;
  }
  if (def.kind === 'number') {
    const n = Number(option.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? { key, value: n } : null;
  }
  if (def.kind === 'enum') {
    const canonical = def.options?.find((o) => normalize(o) === normalize(option));
    return canonical ? { key, value: canonical } : null;
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
export function planTechnicalClarification(state: RequirementState): {
  readonly card: readonly ClarificationQuestion[];
  readonly text: readonly MissingParameter[];
} {
  const card: ClarificationQuestion[] = [];
  const text: MissingParameter[] = [];
  for (const m of technicalMissing(state)) {
    const def = parameterDefinition(m.key);
    if (def.kind === 'enum' && def.options) {
      card.push({ id: m.key, question: m.question, options: def.options, allowUnknown: true });
    } else if (def.kind === 'boolean') {
      card.push({ id: m.key, question: m.question, options: ['Ya', 'Tidak'], allowUnknown: true });
    } else {
      text.push(m);
    }
  }
  return { card, text };
}

export function formatTechnicalValue(p: TechnicalParameter): string {
  if (typeof p.value === 'boolean') return p.value ? 'Ya' : 'Tidak';
  if (typeof p.value === 'number') {
    const n = p.value.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    return p.unit ? `${n} ${p.unit}` : n;
  }
  return p.value;
}

/** Baris "yang sudah saya catat" untuk kartu validasi teknis dan panel. */
export function technicalCaptured(state: RequirementState): readonly KeyValue[] {
  return Object.values(parametersOf(state))
    .filter((p) => p.value !== UNKNOWN)
    .map((p) => ({ label: p.label, value: formatTechnicalValue(p) }));
}

/**
 * Balasan giliran: nama kasus, data yang diketahui, dan — bila masih kurang — pertanyaan dalam
 * bahasa pengguna. Tanpa angka teknik: belum ada yang dihitung di tahap ini.
 */
export function technicalGuidance(state: RequirementState): string {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return '';
  const profile = caseProfile(state.useCase.caseId);
  const known = technicalCaptured(state);
  // Redaksi seperti teknisi yang membalas sendiri: tanpa judul bagian, tanpa penomoran, tanpa
  // kalimat tentang "data"/"asumsi" sebagai konsep — cukup apa yang dicatat dan apa yang ditanya.
  const lines: string[] = [INTRO[state.useCase.caseId]];
  if (known.length > 0) {
    lines.push(
      '',
      `Yang sudah saya catat: ${joinNatural(known.map((r) => `${r.label.toLowerCase()} ${r.value}`))}.`,
    );
  }
  const { text, card } = planTechnicalClarification(state);
  const missing = [...text, ...card.map((q) => ({ question: q.question }))];
  if (missing.length > 0) {
    lines.push('', 'Supaya hitungannya pas, tolong jawab beberapa hal ini:');
    for (const m of missing) lines.push(`- ${m.question}`);
    if (isTechnicalComplete(state) && profile.calculatorStatus === 'available') {
      lines.push(
        '',
        'Kalau mau langsung lihat hasilnya, tekan **Susun rekomendasi** — yang belum disebut saya pakai angka perkiraan awal dan saya tandai jelas di hasilnya.',
      );
    }
  } else if (profile.calculatorStatus === 'available') {
    lines.push(
      '',
      'Datanya sudah cukup. Tekan **Susun rekomendasi** untuk melihat ukuran pipa dan daftar produknya.',
    );
  } else {
    lines.push(
      '',
      'Datanya sudah cukup; saya teruskan ke tim teknis Pralon untuk dihitung, dan hasilnya dikirim ke Anda.',
    );
  }
  return lines.join('\n');
}

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

function joinNatural(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')}, dan ${items[items.length - 1]}`;
}
