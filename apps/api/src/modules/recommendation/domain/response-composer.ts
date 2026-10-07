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
  OUTPUT_LABELS,
  caseProfile,
  caseReadiness,
  isCaseId,
  parameterDefinition,
  isParameterKey,
  resolveMissingParameters,
  type GravityCandidate,
  type SizeCandidate,
} from '@snouty/engineering';
import type {
  ComposedResponse,
  KeyValue,
  OptionStatus,
  ReadinessItem,
  RequirementState,
  SolutionOption,
} from '@snouty/shared-types';
import { UNKNOWN, formatTechnicalValue } from '../../context/domain/technical.js';
import type { IdentifiedTrace } from './solution-view.js';

const id = (n: number): string => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/** Catatan tradeoff per status — bahasa pengguna, tanpa angka (angkanya di `metrics`). */
const OPTION_NOTE: Readonly<Record<OptionStatus, string>> = {
  ok: 'Memenuhi batas kecepatan dan kerugian gesek.',
  too_fast: 'Kecepatan terlalu tinggi: aus, bising, dan hentakan air (water hammer).',
  too_slow: 'Kecepatan terlalu rendah: endapan mengendap di dalam pipa.',
  high_loss: 'Kerugian gesek terlalu besar: butuh pompa lebih kuat atau tekanan di ujung turun.',
  too_small: 'Kapasitas aliran kurang dari debit rencana.',
};
const ALTERNATIVE_NOTE =
  'Satu ukuran di atas rekomendasi: kerugian lebih rendah, biaya pipa lebih tinggi.';

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
}

export function composeResponse(input: ComposerInput): ComposedResponse {
  const { known, assumed } = parametersByOrigin(input.state);
  return {
    knownData: known,
    assumedData: assumed,
    calculations: calculationsFrom(input.traces),
    options: optionsFrom(input),
    readiness: readinessFrom(input.state),
    missingData: missingDataFrom(input.state),
  };
}

function parametersByOrigin(state: RequirementState): {
  known: readonly KeyValue[];
  assumed: readonly KeyValue[];
} {
  if (state.useCase?.kind !== 'technical') return { known: [], assumed: [] };
  const known: KeyValue[] = [];
  const assumed: KeyValue[] = [];
  for (const p of Object.values(state.useCase.parameters)) {
    if (p.value === UNKNOWN) continue; // jawaban "belum tahu" bukan data
    (p.origin === 'known' ? known : assumed).push({
      label: p.label,
      value: formatTechnicalValue(p),
    });
  }
  return { known, assumed };
}

/** Satu baris per aturan, urut eksekusi; label aturan + versi supaya bisa dirujuk ke registry. */
function calculationsFrom(traces: readonly IdentifiedTrace[]): readonly KeyValue[] {
  return traces.map((trace) => ({
    label: `${trace.ruleId} v${trace.ruleVersion}`,
    value: trace.explanation,
  }));
}

function optionsFrom(input: ComposerInput): readonly SolutionOption[] {
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
          { label: 'Diameter dalam', value: `${id(c.innerDiameterMm)} mm` },
          { label: 'Kecepatan', value: `${id(c.velocityMs)} m/s` },
          { label: 'Kerugian gesek', value: `${id(c.frictionLossM)} m` },
          { label: 'Head total', value: `${id(c.totalDynamicHeadM)} m` },
        ],
        note: alternative ? ALTERNATIVE_NOTE : OPTION_NOTE[c.status],
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
        { label: 'Diameter dalam', value: `${id(c.innerDiameterMm)} mm` },
        { label: 'Kapasitas penuh', value: `${id(c.fullFlowLs)} l/s` },
        { label: 'Kecepatan penuh', value: `${id(c.fullVelocityMs)} m/s` },
        { label: 'Pemakaian kapasitas', value: `${id(c.utilisationPercent)} %` },
      ],
      note: OPTION_NOTE[c.status],
    }));
  }
  return [];
}

function readinessFrom(state: RequirementState): readonly ReadinessItem[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  const known = new Set<string>();
  const assumed = new Set<string>();
  for (const [key, p] of Object.entries(state.useCase.parameters)) {
    if (p.value === UNKNOWN) continue;
    (p.origin === 'known' ? known : assumed).add(key);
  }
  const report = caseReadiness({ profile, known, assumed });
  return profile.outputs.map((output) => ({
    output,
    label: OUTPUT_LABELS[output],
    readiness: report.readiness[output],
    missing: (report.missing[output] ?? []).map(parameterLabel),
    improvable: (report.improvable[output] ?? []).map(parameterLabel),
  }));
}

function parameterLabel(key: string): string {
  return isParameterKey(key) ? parameterDefinition(key).label : key;
}

function missingDataFrom(state: RequirementState): readonly KeyValue[] {
  if (state.useCase?.kind !== 'technical' || !isCaseId(state.useCase.caseId)) return [];
  const profile = caseProfile(state.useCase.caseId);
  const known = new Set<string>();
  const assumed = new Set<string>();
  for (const [key, p] of Object.entries(state.useCase.parameters)) {
    if (p.value === UNKNOWN) continue;
    (p.origin === 'known' ? known : assumed).add(key);
  }
  return resolveMissingParameters({ profile, known, assumed }).map((m) => ({
    label: m.label,
    value: m.question,
  }));
}
