/**
 * Regresi laporan SNTY-2026-10-0009 ("masjid cibinong raya", 12 Okt 2026): komersial ringan, 2 lantai,
 * PDAM, air bersih + pembuangan, 4 kamar mandi, 8 wastafel, 0 dapur, bangunan 10 × 8 m, tanah
 * 15 × 12 m. Data diambil dari snapshot produksi. Harapan dihitung tangan dari tabel IPC yang
 * disebut di aturan, bukan disalin dari keluaran engine.
 */
import { DEFAULT_LOCALE, type Recommendation, type RequirementState } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeRequirement } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../domain/recommendation.repository.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-10-12T05:00:00.000Z';

export const STATE_0009: RequirementState = withCompleteness(
  mergeRequirement(
    emptyRequirementState(T0),
    [
      { path: 'building.type', value: 'light_commercial', source: 'user_stated' },
      { path: 'building.floors', value: 2, source: 'user_stated' },
      { path: 'fixtures.bathrooms', value: 4, source: 'user_stated' },
      { path: 'fixtures.basins', value: 8, source: 'user_stated' },
      { path: 'fixtures.kitchens', value: 0, source: 'user_stated' },
      { path: 'water.source', value: 'municipal', source: 'user_stated' },
      { path: 'water.installationType', value: 'both', source: 'user_stated' },
      {
        path: 'building.dimensions',
        value: { lengthM: 10, widthM: 8, landLengthM: 15, landWidthM: 12 },
        source: 'user_stated',
      },
    ],
    T0,
  ).state,
);

export async function analyse0009(
  catalog: readonly import('@snouty/shared-types').Product[] = [],
): Promise<{ rec: Recommendation; traces: readonly TraceToSave[] }> {
  let saved: { rec: Recommendation; traces: readonly TraceToSave[] } | null = null;
  const service = new AnalysisService(
    { findVersionById: async () => null } as never,
    {
      save: async (rec: Recommendation, traces: readonly TraceToSave[]) => {
        saved = { rec, traces };
      },
    } as never,
    { markSolutionReady: async () => undefined } as never,
    null,
    {
      activeVersion: async () =>
        ({ id: 'V'.repeat(26), label: 'erp-uji', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async ({ family, categoryIncludes }) =>
        catalog.filter(
          (p) =>
            p.family === family &&
            (categoryIncludes === undefined || p.category.includes(categoryIncludes)),
        ),
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), STATE_0009, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

describe('regresi laporan SNTY-2026-10-0009 — A: cabang per lantai dan pipa tegak', () => {
  it('air bekas tidak lagi 2": per lantai 2 × 2 + 4 × 1 = 8 DFU (> 6 cabang 2"), stack 16 (> 10) → 2½"', async () => {
    const { rec, traces } = await analyse0009();
    const size = (name: string) => rec.systemLines.find((l) => l.name === name)?.size;
    expect(size('Pipa air bekas PVC D')).toBe('2½"');
    expect(size('Pipa ventilasi air bekas')).toBe('1¼"');
    expect(size('Pipa air kotor PVC D')).toBe('4"');
    expect(traces.filter((t) => t.ruleId === 'ENG-604')).toHaveLength(2);
    expect(rec.systemLines.find((l) => l.name === 'Pipa air bekas PVC D')!.reason).toContain(
      'IPC 710.1(2)',
    );
  });
});

describe('regresi laporan SNTY-2026-10-0009 — B: cabang air bersih dari isinya', () => {
  it('cabang 2 KM (6,4 unit ≈ 0,7 l/s, dalam ≥ 24,2 mm) → 1", bukan 3/4" dari rata-rata 16,8 ÷ 4', async () => {
    const { rec } = await analyse0009();
    const branches = rec.systemLines.filter(
      (l) => l.role === 'branch' && l.name.startsWith('Cabang'),
    );
    expect(branches.map((l) => [l.name, l.size, l.path])).toEqual([
      ['Cabang 2 kamar mandi', '1"', 'Pipa utama → 2 kamar mandi (2 cabang)'],
      ['Cabang 4 wastafel', '1/2"', 'Pipa utama → 4 wastafel (2 cabang)'],
    ]);
    expect(rec.stats.branchCount).toBe(4);
  });
});
