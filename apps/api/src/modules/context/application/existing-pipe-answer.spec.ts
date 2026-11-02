/**
 * P32-52 — "pipa lama saya masih bisa dipakai ngga?" dijawab dari kasusnya. Produksi 2026-11-02:
 * di percakapan renovasi ruko yang sudah mencatat pipa utama lama 3", pertanyaan itu dijawab umur
 * pakai pipa pada umumnya lalu dilempar ke tim teknis.
 */
import { describe, expect, it } from 'vitest';
import type { ExistingPipeCheck } from '@snouty/shared-types';
import { mergeRequirement } from '../domain/context-merger.js';
import { emptyRequirementState } from '../domain/requirement-state.factory.js';
import type { ActiveSolution } from '../domain/active-solution.port.js';
import { existingPipeReply } from './existing-pipe-answer.js';

const T0 = '2026-11-02T00:00:00.000Z';

const stateWithOldPipe = mergeRequirement(
  emptyRequirementState(T0),
  [
    { path: 'building.type', value: 'light_commercial', source: 'user_stated' },
    { path: 'water.workType', value: 'extend', source: 'user_stated' },
    { path: 'water.existingMainSize', value: '3"', source: 'user_stated' },
  ],
  T0,
).state;

const solutionWith = (existingPipe: ExistingPipeCheck): ActiveSolution =>
  ({
    recommendation: { systemLines: [], bom: [], existingPipe } as never,
    stale: false,
  }) satisfies ActiveSolution;

describe('pertanyaan pipa lama', () => {
  it('cukup: pipa lama tetap dipakai, dan yang diperiksa hanya ukurannya', () => {
    const text = existingPipeReply(
      stateWithOldPipe,
      solutionWith({ mode: 'extend', size: '3"', sufficient: true, requiredSize: '2"' }),
      'id',
    );
    expect(text).toContain('Pipa utama lama 3" cukup');
    expect(text).toContain('butuh 2"');
    expect(text).toContain('dilihat di lapangan');
    expect(text).not.toContain('umur pakai');
  });

  it('kurang: disebut diganti, dengan ukuran yang dibutuhkan bebannya', () => {
    const text = existingPipeReply(
      stateWithOldPipe,
      solutionWith({ mode: 'extend', size: '3/4"', sufficient: false, requiredSize: '1"' }),
      'id',
    );
    expect(text).toContain('kurang');
    expect(text).toContain('butuh 1"');
    expect(text).toContain('menggantinya');
  });

  it('ganti semua pipa: dikatakan pipa lama tidak dipakai hitungan ini', () => {
    const text = existingPipeReply(
      stateWithOldPipe,
      solutionWith({ mode: 'replace_all', size: '3"', sufficient: null }),
      'id',
    );
    expect(text).toContain('ganti semua pipa');
    expect(text).toContain('pipa utama lama 3"');
  });

  it('belum dicek: alasan dari hitungan renovasi diucapkan apa adanya', () => {
    const text = existingPipeReply(
      stateWithOldPipe,
      solutionWith({
        mode: 'extend',
        size: '3"',
        sufficient: null,
        uncheckedReason: 'beban yang sudah dilayani pipa lama belum disebut',
      }),
      'id',
    );
    expect(text).toContain('belum saya cek');
    expect(text).toContain('beban yang sudah dilayani pipa lama belum disebut');
  });

  it('belum ada solusi: ukuran lamanya tercatat, yang kurang adalah hitungannya', () => {
    const text = existingPipeReply(stateWithOldPipe, null, 'id');
    expect(text).toContain('Pipa utama lama 3"');
    expect(text).toContain('ukurannya belum dihitung');
  });

  it('tanpa ukuran pipa lama: ukurannya yang ditanya', () => {
    const text = existingPipeReply(emptyRequirementState(T0), null, 'id');
    expect(text).toContain('ukuran pipa lamanya belum disebut');
  });

  it('bahasa Inggris: kalimatnya ikut', () => {
    const text = existingPipeReply(
      stateWithOldPipe,
      solutionWith({ mode: 'extend', size: '3"', sufficient: true, requiredSize: '2"' }),
      'en',
    );
    expect(text).toContain('existing 3" main is big enough');
    expect(text).toContain('seen on site');
  });
});
