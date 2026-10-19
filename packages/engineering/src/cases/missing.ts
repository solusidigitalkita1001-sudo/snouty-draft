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
  readonly labelEn: string;
  readonly questionEn: string;
  /** Sejajar dengan `options`; `options` tetap nilai protokol. */
  readonly optionLabelsEn?: readonly string[];
  readonly importance: 'critical' | 'important' | 'optional';
  /** Keluaran yang masih tertahan oleh parameter ini. */
  readonly unlocks: readonly OutputKey[];
}

export interface CaseReadinessInput {
  readonly profile: CaseProfile;
  readonly known: ReadonlySet<string>;
  readonly assumed: ReadonlySet<string>;
  /** Nilai `work_type` yang tercatat (P23-01); kosong = belum disebut. */
  readonly workType?: string | null;
  /** Pesan menyebut renovasi tanpa jenisnya → `work_type` ditanya lebih dulu. */
  readonly renovationHinted?: boolean;
}

/**
 * Parameter renovasi yang relevan untuk sebuah jenis pekerjaan (P23-01): ditanya hanya bila
 * pekerjaannya memang di instalasi yang ada — bangun baru tidak pernah ditanya pipa lamanya.
 */
export function renovationParameters(
  profile: CaseProfile,
  workType: string | null | undefined,
  renovationHinted = false,
): readonly { readonly key: ParameterKey; readonly importance: 'critical' | 'important' }[] {
  switch (workType) {
    case 'Ganti semua pipa':
      return [{ key: 'existing_pipe_material', importance: 'important' }];
    case 'Ganti sebagian':
      return [
        { key: 'replacement_length', importance: 'important' },
        { key: 'existing_pipe_material', importance: 'important' },
      ];
    case 'Perluasan':
      return [
        { key: 'existing_pipe_size', importance: 'important' },
        ...(profile.existingLoad
          ? [{ key: profile.existingLoad, importance: 'important' as const }]
          : []),
        { key: 'existing_pipe_material', importance: 'important' },
      ];
    case 'Bangun baru':
      return [];
    default:
      return renovationHinted ? [{ key: 'work_type', importance: 'critical' }] : [];
  }
}

/** Kesiapan per keluaran yang dijanjikan profil (kebutuhan profil menimpa baku). */
export function caseReadiness(input: CaseReadinessInput): ReadinessReport {
  const full = resolveReadiness({
    known: knownWithAlternatives(input),
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
  const known = knownWithAlternatives(input);
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
    .filter((key) => !known.has(key) && !input.assumed.has(key))
    .map((key) => ({ key, ...rank(key) }))
    .sort((a, b) => a.importance - b.importance || b.unlocks - a.unlocks);

  // Renovasi (P23-01): jenis pekerjaan yang belum jelas ditanya paling dulu; data pipa lama
  // menyusul setelah parameter kritis kasusnya, sebelum parameter penting lainnya.
  const renovation = renovationParameters(input.profile, input.workType, input.renovationHinted)
    .filter(({ key }) => !known.has(key) && !input.assumed.has(key))
    .map(({ key, importance }) => ({
      key,
      importance: importance === 'critical' ? -1 : 0.5,
      unlocks: 0,
    }));
  const ordered = [...candidates, ...renovation].sort(
    (a, b) => a.importance - b.importance || b.unlocks - a.unlocks,
  );

  return ordered.slice(0, max).map(({ key, importance }) => {
    const def = parameterDefinition(key);
    return {
      key,
      label: def.label,
      question: def.question,
      ...(def.options ? { options: def.options } : {}),
      labelEn: def.labelEn,
      questionEn: def.questionEn,
      ...(def.optionLabelsEn ? { optionLabelsEn: def.optionLabelsEn } : {}),
      importance: importance <= 0 ? 'critical' : importance <= 1 ? 'important' : 'optional',
      unlocks: unlocksOf(key),
    };
  });
}

/**
 * Yang diketahui, ditambah parameter yang penggantinya sudah diketahui (`alternatives` profil):
 * gedung yang luas lantainya disebut tidak perlu ditanya jumlah penghuninya lagi.
 */
function knownWithAlternatives(input: CaseReadinessInput): ReadonlySet<string> {
  const alternatives = input.profile.alternatives;
  if (!alternatives) return input.known;
  const known = new Set(input.known);
  for (const [key, subs] of Object.entries(alternatives)) {
    if (subs?.some((sub) => input.known.has(sub))) known.add(key);
  }
  return known;
}
