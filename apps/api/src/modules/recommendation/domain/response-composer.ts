/**
 * ResponseComposer — bagian tetap jawaban teknis (brief Fase 14 §28), **fungsi murni**.
 *
 * Ringkasan · Data yang diketahui · Asumsi · Perhitungan · Opsi · Rekomendasi · Produk Pralon ·
 * Data yang masih dibutuhkan. Tiga di antaranya sudah punya tempat di `Recommendation`
 * (`headline`/`body`, `assumptions`, `products`); yang lain dirakit di sini dari state kebutuhan,
 * trace aturan, dan kandidat engine. Tidak ada model yang dipanggil: setiap angka datang dari
 * engine, setiap label dari registry, setiap catatan tradeoff dari tabel di berkas ini.
 *
 * Mengapa kandidat ditampilkan, bukan hanya yang dipilih: "PVC 1,5 inci cukup nggak?" dijawab
 * jujur hanya bila pengguna melihat 1,5" di daftar dengan statusnya — bukan sekadar "pakai 2"".
 */
import {
  assumption,
  caseProfile,
  caseReadiness,
  isCaseId,
  isParameterKey,
  outputLabel,
  parameterLabel as registryParameterLabel,
  resolveMissingParameters,
  ruleStepTitle,
  type GravityCandidate,
  type SizeCandidate,
} from '@snouty/engineering';
import { DEFAULT_LOCALE, type Locale } from '@snouty/shared-types';
import type {
  ComposedResponse,
  KeyValue,
  OptionStatus,
  ReadinessItem,
  RequirementState,
  SolutionOption,
} from '@snouty/shared-types';
import {
  UNKNOWN,
  formatTechnicalValue,
  technicalParameterLabel,
} from '../../context/domain/technical.js';
import type { IdentifiedTrace } from './solution-view.js';
import { readableNumbers } from './calculation-steps.js';

const num = (n: number, locale: Locale): string =>
  n.toLocaleString(locale === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 });

/** Catatan tradeoff per status — bahasa pengguna, tanpa angka (angkanya di `metrics`). */
const OPTION_NOTE_ID: Readonly<Record<OptionStatus, string>> = {
  ok: 'Memenuhi batas kecepatan air dan kehilangan tekanan.',
  too_fast: 'Air terlalu cepat: pipa cepat aus, bising, dan bisa terjadi hentakan air.',
  too_slow: 'Air terlalu lambat: kotoran mudah mengendap di dalam pipa.',
  high_loss:
    'Kehilangan tekanan terlalu besar: butuh pompa lebih kuat, atau tekanan di ujung turun.',
  too_small: 'Kapasitas aliran kurang dari debit rencana.',
};
const OPTION_NOTE_EN: Readonly<Record<OptionStatus, string>> = {
  ok: 'Meets the limits for water speed and pressure loss.',
  too_fast: 'Velocity too high: wear, noise, and water hammer.',
  too_slow: 'Velocity too low: sediment settles inside the pipe.',
  high_loss: 'Pressure loss too high: needs a stronger pump, or the pressure at the far end drops.',
  too_small: 'Flow capacity is below the design flow.',
};
const OPTION_NOTE = { id: OPTION_NOTE_ID, en: OPTION_NOTE_EN } as const;
const ALTERNATIVE_NOTE = {
  id: 'Satu ukuran di atas rekomendasi: kerugian lebih rendah, biaya pipa lebih tinggi.',
  en: 'One size above the recommendation: lower loss, higher pipe cost.',
} as const;

const METRIC_LABELS = {
  id: {
    innerDiameter: 'Diameter dalam',
    velocity: 'Kecepatan',
    frictionLoss: 'Kehilangan tekanan',
    totalHead: 'Tinggi angkat',
    fullFlow: 'Kapasitas penuh',
    fullVelocity: 'Kecepatan penuh',
    utilisation: 'Pemakaian kapasitas',
  },
  en: {
    innerDiameter: 'Inner diameter',
    velocity: 'Velocity',
    frictionLoss: 'Pressure loss',
    totalHead: 'Total lift',
    fullFlow: 'Full-bore capacity',
    fullVelocity: 'Full-bore velocity',
    utilisation: 'Capacity utilisation',
  },
} as const;

export interface ComposerInput {
  readonly state: RequirementState;
  readonly traces: readonly IdentifiedTrace[];
  /** Kandidat ukuran engine bertekanan (Kelompok F) — `undefined` untuk kasus tanpa kandidat. */
  readonly pressurized?: {
    readonly candidates: readonly SizeCandidate[];
    readonly recommendedSize: string;
    readonly alternativeSize: string | null;
  };
  /** Kandidat ukuran engine gravitasi (Kelompok H). */
  readonly gravity?: {
    readonly candidates: readonly GravityCandidate[];
    readonly recommendedSize: string;
  };
  /**
   * Asumsi registry yang dipakai engine/perencana (`appliedAssumptionIds`, `extraAssumptionIds`).
   * Parameter yang diisinya dihitung "diasumsikan" oleh kesiapan — tanpa ini sizing yang baru
   * saja dihitung dilaporkan "DATA KURANG" hanya karena bahan dipilih lewat asumsi.
   */
  readonly appliedAssumptionIds?: readonly string[];
  /** Bahasa teks tetap (catatan, label metrik, label kesiapan); default Indonesia. */
  readonly locale?: Locale;
}

export function composeResponse(input: ComposerInput): ComposedResponse {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const { known, assumed } = parametersByOrigin(input.state, locale);
  const sets = parameterSets(
    input.state,
    input.appliedAssumptionIds ?? [],
    (input.pressurized ?? input.gravity) !== undefined,
  );
  return {
    knownData: known,
    assumedData: assumed,
    calculations: calculationsFrom(input.traces, locale),
    options: optionsFrom(input, locale),
    readiness: readinessFrom(input.state, sets, locale),
    missingData: missingDataFrom(input.state, sets, locale),
  };
}

interface ParameterSets {
  readonly known: ReadonlySet<string>;
  readonly assumed: ReadonlySet<string>;
}

/**
 * Parameter diketahui/diasumsikan: dari state, ditambah parameter yang diisi asumsi engine.
 * `sized` = engine sudah memilih diameter: `nominal_diameter` terhitung ("diketahui dari
 * perhitungan", `ReadinessInput.known`) — tanpa ini kesiapan pompa dilaporkan kurang diameter
 * padahal diameternya baru saja ditetapkan oleh engine yang sama.
 */
function parameterSets(
  state: RequirementState,
  appliedAssumptionIds: readonly string[],
  sized: boolean,
): ParameterSets {
  const known = new Set<string>();
  const assumed = new Set<string>();
  if (sized) known.add('nominal_diameter');
  if (state.useCase?.kind === 'technical') {
    for (const [key, p] of Object.entries(state.useCase.parameters)) {
      if (p.value === UNKNOWN) continue;
      (p.origin === 'known' ? known : assumed).add(key);
    }
  }
  for (const id of appliedAssumptionIds) {
    const parameter = assumption(id).parameter;
    if (!known.has(parameter)) assumed.add(parameter);
  }
  return { known, assumed };
}

function parametersByOrigin(
  state: RequirementState,
  locale: Locale,
): {
  known: readonly KeyValue[];
  assumed: readonly KeyValue[];
} {
  if (state.useCase?.kind !== 'technical') return { known: [], assumed: [] };
  const known: KeyValue[] = [];
  const assumed: KeyValue[] = [];
  for (const [key, p] of Object.entries(state.useCase.parameters)) {
    if (p.value === UNKNOWN) continue; // jawaban "belum tahu" bukan data
    (p.origin === 'known' ? known : assumed).push({
      label: technicalParameterLabel(key, p, locale),
      value: formatTechnicalValue(p, locale, key),
    });
  }
  return { known, assumed };
}

/**
 * Satu baris per langkah hitung, urut eksekusi. Labelnya judul langkah yang bisa dibaca — kode dan
 * versi aturan tetap tersimpan di trace untuk audit, tidak ditampilkan (laporan pemilik 2026-10-09).
 */
function calculationsFrom(traces: readonly IdentifiedTrace[], locale: Locale): readonly KeyValue[] {
  return traces.map((trace) => ({
    label: ruleStepTitle(trace.ruleId, locale),
    value: readableNumbers(trace.explanation, locale),
  }));
}

function optionsFrom(input: ComposerInput, locale: Locale): readonly SolutionOption[] {
  const label = METRIC_LABELS[locale];
  if (input.pressurized) {
    const { candidates, recommendedSize, alternativeSize } = input.pressurized;
    return candidates.map((c) => {
      const alternative = c.size === alternativeSize;
      return {
        size: c.size,
        status: c.status,
        recommended: c.size === recommendedSize,
        alternative,
        metrics: [
          { label: label.innerDiameter, value: `${num(c.innerDiameterMm, locale)} mm` },
          { label: label.velocity, value: `${num(c.velocityMs, locale)} m/s` },
          { label: label.frictionLoss, value: `${num(c.frictionLossM, locale)} m` },
          { label: label.totalHead, value: `${num(c.totalDynamicHeadM, locale)} m` },
        ],
        note: alternative ? ALTERNATIVE_NOTE[locale] : OPTION_NOTE[locale][c.status],
      };
    });
  }
  if (input.gravity) {
    const { candidates, recommendedSize } = input.gravity;
    return candidates.map((c) => ({
      size: c.size,
      status: c.status,
      recommended: c.size === recommendedSize,
      alternative: false,
      metrics: [
        { label: label.innerDiameter, value: `${num(c.innerDiameterMm, locale)} mm` },
        { label: label.fullFlow, value: `${num(c.fullFlowLs, locale)} l/s` },
        { label: label.fullVelocity, value: `${num(c.fullVelocityMs, locale)} m/s` },
        { label: label.utilisation, value: `${num(c.utilisationPercent, locale)} %` },
      ],
      note: OPTION_NOTE[locale][c.status],
    }));
  }
  return [];
}

function readinessFrom(
  state: RequirementState,
  sets: ParameterSets,
  locale: Locale,
): readonly ReadinessItem[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  const report = caseReadiness({ profile, known: sets.known, assumed: sets.assumed });
  return profile.outputs.map((output) => ({
    output,
    label: outputLabel(output, locale),
    readiness: report.readiness[output],
    missing: (report.missing[output] ?? []).map((key) => parameterLabel(key, locale)),
    improvable: (report.improvable[output] ?? []).map((key) => parameterLabel(key, locale)),
  }));
}

function parameterLabel(key: string, locale: Locale): string {
  return isParameterKey(key) ? registryParameterLabel(key, locale) : key;
}

function missingDataFrom(
  state: RequirementState,
  sets: ParameterSets,
  locale: Locale,
): readonly KeyValue[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  return resolveMissingParameters({
    profile,
    known: sets.known,
    assumed: sets.assumed,
  }).map((m) => ({
    label: locale === 'en' ? m.labelEn : m.label,
    value: locale === 'en' ? m.questionEn : m.question,
  }));
}
