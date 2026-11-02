/**
 * P4-03a — kelengkapan menghitung TEPAT empat field inti (CONTEXT_ENGINE §9 #6).
 */
import { describe, expect, it } from 'vitest';
import { completenessCaption, evaluateCompleteness, withCompleteness } from './completeness.js';
import { mergeRequirement } from './context-merger.js';
import { emptyRequirementState } from './requirement-state.factory.js';

const T0 = '2026-01-01T00:00:00.000Z';
const fill = (paths: Array<[string, unknown]>) =>
  mergeRequirement(
    emptyRequirementState(T0),
    paths.map(([path, value]) => ({ path: path as never, value, source: 'user_stated' as const })),
    T0,
  ).state;

describe('CompletenessEvaluator', () => {
  it('state kosong: 0 dari 4 terisi, empat field inti kurang', () => {
    const r = evaluateCompleteness(emptyRequirementState(T0));
    expect(r.completeness).toEqual({ filled: 0, required: 4 });
    expect(r.missingInformation).toEqual([
      'water.source',
      'water.installationType',
      'building.floors',
      'fixtures.bathrooms',
    ]);
    expect(r.isComplete).toBe(false);
  });

  it('field non-inti tidak menambah kelengkapan', () => {
    const state = fill([
      ['fixtures.basins', 4],
      ['fixtures.kitchens', 1],
      ['building.floorHeightM', 3.5],
    ]);
    expect(evaluateCompleteness(state).completeness.filled).toBe(0);
  });

  it('empat field inti terisi → lengkap', () => {
    const state = fill([
      ['water.source', 'rooftop_tank'],
      ['water.installationType', 'clean_water'],
      ['building.floors', 2],
      ['fixtures.bathrooms', 3],
    ]);
    const r = evaluateCompleteness(state);
    expect(r.completeness.filled).toBe(4);
    expect(r.missingInformation).toEqual([]);
    expect(r.isComplete).toBe(true);
  });

  it('"tidak ada" (value 0) tetap dihitung terisi', () => {
    const state = fill([['fixtures.bathrooms', 0]]);
    expect(evaluateCompleteness(state).completeness.filled).toBe(1);
  });

  it('withCompleteness menulis turunan ke dalam state', () => {
    const state = withCompleteness(fill([['building.floors', 2]]));
    expect(state.completeness.filled).toBe(1);
    expect(state.missingInformation).toContain('water.source');
  });

  it('caption mengikuti salinan desain', () => {
    expect(completenessCaption(evaluateCompleteness(emptyRequirementState(T0)))).toBe(
      '4 kelompok data lagi sebelum SNOUTY dapat menyusun rekomendasi.',
    );
    const complete = fill([
      ['water.source', 'pump'],
      ['water.installationType', 'both'],
      ['building.floors', 1],
      ['fixtures.bathrooms', 1],
    ]);
    expect(completenessCaption(evaluateCompleteness(complete))).toBe(
      'Data inti sudah lengkap. Nilai yang tidak diberikan tetap ditandai sebagai asumsi.',
    );
  });
});

/**
 * P32-50 — pekerjaan pembuangan saja tidak punya sumber air. Produksi 2026-11-02: "mau bikin
 * saluran air kotor rumah 2 lantai" dijawab "yang belum disebut saya anggap dulu … air dari toren
 * atap tanpa pompa pendorong" — anggapan yang tidak dipakai hitungan buangan sama sekali.
 */
describe('pekerjaan pembuangan saja', () => {
  it('sumber air tidak termasuk data inti, dan tiga data sudah lengkap', () => {
    const drainage = fill([
      ['water.installationType', 'drainage'],
      ['building.floors', 2],
      ['fixtures.bathrooms', 3],
    ]);
    const r = evaluateCompleteness(drainage);
    expect(r.completeness).toEqual({ filled: 3, required: 3 });
    expect(r.missingInformation).toEqual([]);
    expect(r.isComplete).toBe(true);
  });

  it('air bersih dan gabungan tetap menunggu sumber airnya', () => {
    for (const type of ['clean_water', 'both']) {
      const state = fill([
        ['water.installationType', type],
        ['building.floors', 2],
        ['fixtures.bathrooms', 3],
      ]);
      const r = evaluateCompleteness(state);
      expect(r.completeness).toEqual({ filled: 3, required: 4 });
      expect(r.missingInformation).toEqual(['water.source']);
    }
  });
});
