/**
 * MissingParameterResolver (brief §8 — fase 2): parameter mana yang ditanya berikutnya.
 *
 * Bukan kuesioner: maksimum empat, diurutkan dari yang paling membuka keluaran — parameter
 * kritis yang masih menahan paling banyak keluaran ditanya lebih dulu, lalu urutan profil.
 * Yang sudah diketahui atau sudah diasumsikan TIDAK ditanya lagi (asumsi tampil di bagiannya
 * sendiri dan bisa diperbaiki pengguna kapan saja).
 */

import { parameterDefinition, type ParameterKey } from '../parameters/registry.js';
import { resolveReadiness, type OutputKey, type ReadinessReport } from '../parameters/readiness.js';
import type { CaseProfile } from './profiles.js';

export const MAX_QUESTIONS = 4;

export interface MissingParameter {
  readonly key: ParameterKey;
  readonly label: string;
  /** Redaksi bahasa pengguna dari registry, siap ditampilkan. */
  readonly question: string;
  readonly options?: readonly string[];
  readonly importance: 'critical' | 'important' | 'optional';
  /** Keluaran yang masih tertahan oleh parameter ini. */
  readonly unlocks: readonly OutputKey[];
}

export interface CaseReadinessInput {
  readonly profile: CaseProfile;
  readonly known: ReadonlySet<string>;
  readonly assumed: ReadonlySet<string>;
}

/** Kesiapan per keluaran yang dijanjikan profil (kebutuhan profil menimpa baku). */
export function caseReadiness(input: CaseReadinessInput): ReadinessReport {
  const full = resolveReadiness({
    known: input.known,
    assumed: input.assumed,
    ...(input.profile.outputRequirements ? { overrides: input.profile.outputRequirements } : {}),
  });
  const pick = <T>(record: Readonly<Record<OutputKey, T>>): Readonly<Record<OutputKey, T>> =>
    Object.fromEntries(input.profile.outputs.map((o) => [o, record[o]])) as Readonly<
      Record<OutputKey, T>
    >;
  return {
    readiness: pick(full.readiness),
    missing: pick(full.missing),
    improvable: pick(full.improvable),
  };
}

export function resolveMissingParameters(
  input: CaseReadinessInput,
  max: number = MAX_QUESTIONS,
): readonly MissingParameter[] {
  const report = caseReadiness(input);
  const unlocksOf = (key: ParameterKey): OutputKey[] =>
    input.profile.outputs.filter((o) => report.missing[o]?.includes(key));

  const rank = (key: ParameterKey) => {
    const importance = input.profile.critical.includes(key)
      ? 0
      : input.profile.important.includes(key)
        ? 1
        : 2;
    return { importance, unlocks: unlocksOf(key).length };
  };

  const candidates = [...input.profile.critical, ...input.profile.important]
    .filter((key) => !input.known.has(key) && !input.assumed.has(key))
    .map((key) => ({ key, ...rank(key) }))
    .sort((a, b) => a.importance - b.importance || b.unlocks - a.unlocks);

  return candidates.slice(0, max).map(({ key, importance }) => {
    const def = parameterDefinition(key);
    return {
      key,
      label: def.label,
      question: def.question,
      ...(def.options ? { options: def.options } : {}),
      importance: importance === 0 ? 'critical' : importance === 1 ? 'important' : 'optional',
      unlocks: unlocksOf(key),
    };
  });
}
