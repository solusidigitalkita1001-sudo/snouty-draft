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
  extractTechnicalContext,
  isCaseId,
  isParameterKey,
  parameterDefinition,
  parameterLabel,
  parameterOptionLabels,
  renovationCue,
  resolveMissingParameters,
  unitLabel,
  unknownDefault,
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

/**
 * Kasus yang sebenarnya BAGIAN dari pekerjaan bangunan yang sedang dibahas: buangannya ke
 * septic tank, air hujan dari atapnya, pompa pendorongnya, sumurnya. Di percakapan yang
 * bangunannya sudah tercatat, menyebut salah satunya bukan proyek baru — jalur bangunan yang
 * menghitungnya. Produksi 2026-10-26: "septic tanknya 8 meter dari rumah" pada instalasi
 * pembuangan rumah 2 lantai membuka kasus saluran gravitasi, lalu menanyakan debit rencana,
 * kemiringan saluran, dan elevasi hulu — empat angka yang tidak dipunyai pemilik rumah,
 * padahal ukuran pipa buangannya dihitung dari jumlah alatnya.
 */
/**
 * Pesan ini menyatakan kasusnya SENDIRI, bukan satu ukuran dari pekerjaan bangunan yang sedang
 * dibahas: dua angka parameter atau lebih. "pipa buangan ke saluran kota 40 meter, beda tinggi
 * 1,5 m" punya panjang dan beda tinggi — saluran gravitasi yang memang bisa dihitung sendiri.
 * "septic tanknya 8 meter dari rumah" hanya punya satu angka; jenis cairannya terbaca dari kata,
 * bukan dari angka, jadi ia tidak ikut dihitung.
 */
export function statesOwnCase(caseId: CaseId, message: string): boolean {
  const figures = extractTechnicalContext(message, caseId).filter(
    (fact) => typeof fact.value === 'number',
  );
  return figures.length >= 2;
}

export const BUILDING_ASPECTS: readonly CaseId[] = [
  'gravity_drainage',
  'stormwater',
  'pump_transfer',
  'well_distribution',
];

/**
 * Kasus teknis untuk giliran ini: lanjutan percakapan teknis yang sudah berjalan, atau jenis
 * kasus yang DIKENALI dari pesan (katalog data `use-case`, P16-14 — menggantikan pengklasifikasi
 * regex berbobot). `null` = bukan jalur ini.
 */
export function detectTechnicalCase(
  useCase: string | null,
  state: RequirementState,
): CaseId | null {
  if (state.useCase?.kind === 'technical' && isCaseId(state.useCase.caseId)) {
    return state.useCase.caseId;
  }
  if (useCase === null || !isCaseId(useCase) || OWN_TRACK.includes(useCase)) return null;
  return useCase;
}

function parametersOf(state: RequirementState): Readonly<Record<string, TechnicalParameter>> {
  return state.useCase?.kind === 'technical' ? state.useCase.parameters : {};
}

function withParameters(
  state: RequirementState,
  caseId: CaseId,
  parameters: Readonly<Record<string, TechnicalParameter>>,
  /** Pesan menyebut renovasi tanpa jenisnya (P23-02); gugur begitu `work_type` tercatat. */
  renovationHinted = state.useCase?.kind === 'technical' && state.useCase.renovationHinted === true,
): RequirementState {
  const hinted = renovationHinted && parameters['work_type'] === undefined;
  const useCase: TechnicalUseCase = {
    kind: 'technical',
    caseId,
    parameters,
    ...(hinted ? { renovationHinted: true } : {}),
  };
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
  const recordedFloors = parametersOf(state)['building_floors']?.value;
  const facts = extractTechnicalContext(
    message,
    caseId,
    typeof recordedFloors === 'number'
      ? recordedFloors
      : (state.building.floors.value ?? undefined),
  );
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
  const wasHinted = state.useCase?.kind === 'technical' && state.useCase.renovationHinted === true;
  const hinted = wasHinted || renovationCue(message);
  if (hinted && next['work_type'] === undefined && !wasHinted) changed = true;
  return { state: withParameters(state, caseId, next, hinted), changed, captured };
}

/**
 * Jumlah lantai yang sudah tercatat di kebutuhan bangunan ikut ke kasus gedung bertingkat —
 * "rumah 3 lantai" lalu "jadi 12 lantai" tidak perlu ditanya lantainya lagi.
 */
export function carryBuildingFloors(state: RequirementState, caseId: CaseId): RequirementState {
  const floors = state.building.floors.value;
  if (caseId !== 'multistorey_building_water' || floors === null) return state;
  const current = parametersOf(state);
  if (current['building_floors'] !== undefined) return state;
  return withParameters(state, caseId, {
    ...current,
    building_floors: {
      label: parameterDefinition('building_floors').label,
      value: floors,
      unit: 'lantai',
      origin: 'known',
      evidence: `${floors} lantai`,
    },
  });
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
    // Isian kartu dikirim sebagai `kunci=angka` (sama dengan ukuran bangunan); selain itu angka bebas.
    const typed = option.match(/^([a-z_]+)=([-\d.,]+)$/);
    if (typed && typed[1] !== key) return null;
    const raw = typed ? typed[2]! : option;
    const n = Number(raw.replace(/[^\d.,-]/g, '').replace(',', '.'));
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
  const caseId = state.useCase?.kind === 'technical' ? state.useCase.caseId : null;
  for (const [key, p] of Object.entries(parametersOf(state))) {
    if (p.origin === 'known') {
      known.add(key);
      continue;
    }
    // "Belum tahu" pada parameter KRITIS hanya terpenuhi bila kasusnya punya asumsi registry untuk
    // menggantinya; tanpa itu hitungannya memang tidak bisa dibuat dan parameter tetap ditanya
    // (simulasi 2026-10-19: "Datanya sudah cukup" lalu analisis gagal "layanan tidak tersedia").
    if (p.value === UNKNOWN && caseId !== null && isUnresolvedUnknown(caseId, key)) continue;
    assumed.add(key);
  }
  return { known, assumed };
}

/** Parameter kritis yang dijawab "Belum tahu" dan tidak punya asumsi pengganti di profil kasus. */
function isUnresolvedUnknown(caseId: string, key: string): boolean {
  if (!isCaseId(caseId) || !isParameterKey(key)) return false;
  return caseProfile(caseId).critical.includes(key) && unknownDefault(caseId, key) === undefined;
}

/** Label parameter kritis yang sudah dijawab "Belum tahu" tetapi tetap dibutuhkan hitungannya. */
export function unresolvedUnknowns(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
): readonly string[] {
  if (state.useCase?.kind !== 'technical') return [];
  const caseId = state.useCase.caseId;
  return Object.entries(state.useCase.parameters)
    .filter(([key, p]) => p.value === UNKNOWN && isUnresolvedUnknown(caseId, key))
    .map(([key, p]) => (isParameterKey(key) ? parameterLabel(key, locale) : p.label).toLowerCase());
}

/**
 * Permintaan menghitung ("udah, itung aja") di kasus teknis: parameter yang belum diketahui dan
 * PUNYA anggapan — bukan kritis, atau kritis dengan asumsi registry — dicatat "Belum tahu"
 * sehingga hitungannya jalan dengan anggapan bertanda, seperti permintaan menghitung di jalur
 * bangunan (P31-52). Parameter kritis tanpa anggapan tetap ditanya: tanpa angkanya hitungannya
 * memang tidak ada. Produksi 2026-10-27: "itung aja" pada drainase air hujan yang luas
 * tangkapannya sudah disebut dijawab daftar empat angka — intensitas hujan, panjang jalur,
 * kemiringan, koefisien limpasan — padahal keempatnya punya anggapan.
 */
export function assumeTechnicalUnknowns(state: RequirementState): {
  readonly state: RequirementState;
  readonly changed: boolean;
} {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) {
    return { state, changed: false };
  }
  const caseId = state.useCase.caseId;
  const answers = technicalMissing(state)
    .filter((p) => !isUnresolvedUnknown(caseId, p.key))
    .map((p) => ({ key: p.key, value: UNKNOWN }));
  return applyTechnicalAnswers(state, answers);
}

/** Parameter yang masih perlu ditanya, urut dampak — maksimum empat (brief §8). */
export function technicalMissing(state: RequirementState): readonly MissingParameter[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  const workType = state.useCase.parameters['work_type']?.value;
  return resolveMissingParameters({
    profile,
    ...sets(state),
    workType: typeof workType === 'string' ? workType : null,
    renovationHinted: state.useCase.renovationHinted === true,
  });
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
      // Angka dengan pilihan cepat ("kasih gw pilihan", pemilik 2026-10-09) tampil di kartu;
      // pengguna tetap boleh mengetik angka lain. Tanpa pilihan → ditanya di teks.
      const options = numberSuggestions(state, m.key) ?? def.suggestions;
      if (options && options.length > 0) {
        card.push({ id: m.key, question, options, allowUnknown: true });
      } else if (def.kind === 'number') {
        // Angka inti ditanya di kartu sebagai isian (pemilik 2026-10-16: alur kasus teknis harus seperti
        // rumah — data inti di kartu, bukan teks yang diulang sementara kartu menanyakan hal sekunder).
        const label = locale === 'en' ? def.labelEn : def.label;
        const range = numberRange(def.unit);
        card.push({
          id: m.key,
          question,
          options: [],
          allowUnknown: true,
          inputs: [
            {
              key: m.key,
              group: label,
              label,
              unit: def.unit ? unitLabel(def.unit, locale) : '',
              required: m.importance === 'critical',
              min: range.min,
              max: range.max,
            },
          ],
        });
      } else {
        text.push(m);
      }
    }
  }
  return { card, text };
}

/** Batas isian angka per satuan — pagar masukan, bukan kriteria teknik. */
function numberRange(unit: string | undefined): { readonly min: number; readonly max: number } {
  switch (unit) {
    case 'm':
      return { min: 0.1, max: 100_000 };
    case 'l/s':
      return { min: 0.01, max: 100_000 };
    case 'ha':
      return { min: 0.01, max: 100_000 };
    case 'mm/jam':
      return { min: 1, max: 500 };
    case '%':
      return { min: 0.01, max: 100 };
    case 'bar':
      return { min: 0.1, max: 50 };
    case 'jam':
      return { min: 0.1, max: 24 };
    default:
      return { min: 1, max: 5_000_000 };
  }
}

/**
 * Pilihan yang dihitung dari data kasus — tinggi bangunan dari jumlah lantai × tinggi lantai yang
 * lazim (3,5 / 4 / 4,5 m), sehingga pilihannya masuk akal untuk gedung ini, bukan angka tetap.
 */
function numberSuggestions(state: RequirementState, key: ParameterKey): readonly string[] | null {
  if (key !== 'building_height') return null;
  const floors = parametersOf(state)['building_floors']?.value;
  if (typeof floors !== 'number' || floors <= 0) return null;
  return [3.5, 4, 4.5].map(
    (h) => `${String(Math.round(floors * h * 10) / 10).replace('.', ',')} m`,
  );
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
    const format = (x: number) =>
      x.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });
    // Luas di bawah satu hektar (atap, halaman) dibaca dalam m²: "150 m²", bukan "0,02 ha" yang
    // sudah terbulatkan (audit 2026-10-19: talang atap 150 m2 tercatat 0,02 ha).
    if (p.unit === 'ha' && p.value < 1) return `${format(p.value * 10_000)} m²`;
    const n = format(p.value);
    if (!p.unit) return n;
    return p.unit === '%' ? `${n}%` : `${n} ${unitLabel(p.unit, locale)}`;
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
  options: { readonly withIntro?: boolean; readonly computing?: boolean } = {},
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
          known.map((r) => capturedPhrase(r.label, r.value)),
          locale,
        ),
      ),
    );
  }
  const { text, card } = planTechnicalClarification(state, locale);
  const stillNeeded = unresolvedUnknowns(state, locale);
  if (stillNeeded.length > 0) lines.push('', copy.stillNeeded(joinNatural(stillNeeded, locale)));
  // Pertanyaan pilihan tampil sebagai kartu di bawah teks; mengulangnya di sini membuat
  // pengguna membaca pertanyaan yang sama dua kali (audit keterbacaan 2026-10-08).
  const missing = text.map((m) => (locale === 'en' ? m.questionEn : m.question));
  if (missing.length > 0 || card.length > 0) {
    // Semua pertanyaan punya pilihan → kalimat pengantar menunjuk kartunya, bukan daftar kosong.
    lines.push('', missing.length > 0 ? copy.askIntro : copy.pickIntro);
    for (const question of missing) lines.push(`- ${question}`);
    if (isTechnicalComplete(state) && profile.calculatorStatus === 'available') {
      lines.push('', options.computing === true ? copy.computing : copy.proceedWithDefaults);
    }
  } else if (profile.calculatorStatus === 'available') {
    // Pengguna sendiri yang meminta menghitung: yang dikatakan hasilnya sedang dibuat, bukan
    // tombol untuk membuatnya (P31-62).
    lines.push('', options.computing === true ? copy.computing : copy.readyToCompute);
  } else {
    lines.push('', copy.readyForTeam);
  }
  // Tanpa pembuka, baris kosong pemisah pertama tidak diperlukan.
  return lines.join('\n').replace(/^\n+/, '');
}

/**
 * Balasan langsung untuk pesan lanjutan tanpa data baru dalam kasus teknis ("lu belum nanya kamar
 * mandi", "kasih gw pilihan"): apa yang masih ditanya — dari daftar parameter kasus, bukan dari
 * kalimat pengguna — dan ke mana menjawabnya. Instan; model hanya dipakai untuk pertanyaan yang
 * butuh penjelasan (benchmark 2026-10-09: 9B 20–25 s, 4B 12–14 s dengan kesalahan teknis).
 */
export function technicalNudge(
  state: RequirementState,
  locale: Locale = DEFAULT_LOCALE,
  /** Pesan meminta ISI lebih banyak (daftar barang, rincian) — bukan sekadar mendorong. */
  askedForMore = false,
): string {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return '';
  const en = locale === 'en';
  const asked = technicalMissing(state).map((m) => (en ? m.labelEn : m.label).toLowerCase());
  const { card } = planTechnicalClarification(state, locale);
  const ready = isTechnicalComplete(state);
  if (asked.length === 0) return GUIDANCE_COPY[locale].readyToCompute;
  const list = joinNatural(asked, locale);
  const where =
    card.length > 0
      ? en
        ? 'The options are below, or type the numbers directly'
        : 'Pilihannya ada di bawah, atau ketik angkanya langsung'
      : en
        ? 'Just type the numbers'
        : 'Ketik saja angkanya';
  const proceed = ready
    ? en
      ? '; to see the calculation right away, press **Compose recommendation**.'
      : '; kalau mau langsung lihat hitungannya, tekan **Susun rekomendasi**.'
    : '.';
  // "material listnya dong" dijawab kalimat yang sama dengan dorongan biasa, jadi dua
  // pertanyaan berbeda berturut-turut mendapat teks identik (produksi 2026-10-26). Daftar
  // barangnya memang keluar dari hitungan, dan itu yang dikatakan.
  if (askedForMore) {
    return en
      ? `The item list comes out of the calculation, and for that I still need ${list}. ${where}${proceed}`
      : `Daftar barangnya keluar dari hitungannya, dan untuk itu saya masih perlu ${list}. ${where}${proceed}`;
  }
  return en
    ? `Still to settle: ${list}. ${where}${proceed}`
    : `Yang masih saya perlukan: ${list}. ${where}${proceed}`;
}

/**
 * "jumlah sambungan 50 sambungan" → "50 sambungan": bila satuan nilainya sudah menyebut labelnya,
 * nilainya berdiri sendiri (tes FAQ 2026-10-12); selain itu "jarak 150 m".
 */
export function capturedPhrase(label: string, value: string): string {
  const unit = value.trim().split(/\s+/).slice(1).join(' ').toLowerCase();
  // Satuan yang sudah menjadi KATA di labelnya ("10 kolam" untuk "Jumlah kolam") tidak diulang; satuan
  // yang kebetulan substring ("m" di "Kedalaman sumur") bukan alasan membuang labelnya (smoke 2026-10-16).
  const words = label.toLowerCase().split(/[\s/]+/);
  // Nilai pilihan berhuruf kapital di tengah kalimat ("sumber air Sumur") ditulis kecil; singkatan
  // ("PDAM", "HDPE") tetap (audit 2026-10-19).
  const inSentence = /^\p{Lu}\p{Ll}/u.test(value)
    ? value[0]!.toLowerCase() + value.slice(1)
    : value;
  return unit !== '' && words.includes(unit) ? value : `${label.toLowerCase()} ${inSentence}`;
}

interface GuidanceCopy {
  readonly captured: (joined: string) => string;
  readonly pickIntro: string;
  readonly askIntro: string;
  readonly proceedWithDefaults: string;
  readonly readyToCompute: string;
  readonly computing: string;
  readonly readyForTeam: string;
  readonly stillNeeded: (labels: string) => string;
}

const GUIDANCE_COPY: Readonly<Record<Locale, GuidanceCopy>> = {
  id: {
    captured: (joined) => `Yang sudah saya catat: ${joined}.`,
    askIntro: 'Supaya hitungannya pas, tolong jawab beberapa hal ini:',
    pickIntro: 'Supaya hitungannya pas, pilih jawabannya di bawah, atau ketik angkanya langsung.',
    proceedWithDefaults:
      'Kalau mau langsung lihat hasilnya, tekan **Susun rekomendasi** — yang belum disebut saya pakai angka perkiraan awal dan saya tandai jelas di hasilnya.',
    readyToCompute:
      'Datanya sudah cukup. Tekan **Susun rekomendasi** untuk melihat ukuran pipa dan daftar produknya.',
    computing:
      'Yang belum disebut saya pakai angka perkiraan awal dan saya tandai di hasilnya. Ukuran pipa dan daftar produknya saya hitung sekarang.',
    readyForTeam:
      'Datanya sudah cukup; saya teruskan ke tim teknis Pralon untuk dihitung, dan hasilnya dikirim ke Anda.',
    stillNeeded: (labels) =>
      `Ukuran pipanya baru bisa dihitung kalau ${labels} diketahui. Perkiraan kasar pun cukup, nanti saya tandai di hasilnya.`,
  },
  en: {
    captured: (joined) => `What I have noted so far: ${joined}.`,
    askIntro: 'So the calculation fits, please answer a few things:',
    pickIntro: 'So the calculation fits, pick the answers below, or type the numbers directly.',
    proceedWithDefaults:
      'If you want to see the result right away, press **Compose recommendation** — anything not mentioned uses an initial estimate that I mark clearly in the result.',
    readyToCompute:
      'That is enough data. Press **Compose recommendation** to see the pipe sizes and the product list.',
    computing:
      'Anything not mentioned uses an initial estimate that I mark in the result. I am working out the pipe sizes and the product list now.',
    readyForTeam:
      'That is enough data; I will pass it to the Pralon technical team to calculate, and the result will be sent to you.',
    stillNeeded: (labels) =>
      `The pipe size can only be worked out once the ${labels} is known. A rough estimate is enough; I will mark it in the result.`,
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
  water_supply_network:
    'Oke, jaringan air minum. Saya hitung kebutuhan puncak dari sambungan atau jiwa yang dilayani, lalu ukuran pipa transmisi/distribusinya.',
  sewerage:
    'Oke, jaringan air limbah. Saya hitung debit air limbah dari sambungan rumah, lalu diameter dan kemiringan pipanya.',
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
  water_supply_network:
    "Okay, a drinking-water network. I'll work out the peak demand from the connections or people served, then the transmission/distribution pipe size.",
  sewerage:
    "Okay, a sewerage network. I'll work out the wastewater flow from the house connections, then the pipe diameter and slope.",
};

function joinNatural(items: readonly string[], locale: Locale = DEFAULT_LOCALE): string {
  if (items.length <= 1) return items.join('');
  const and = locale === 'en' ? 'and' : 'dan';
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${and} ${items[items.length - 1]}`;
}
