/**
 * Regresi smoke test pemilik 13 Nov 2026 (Fase 37) — skenario yang dilaporkan, dijalankan lewat
 * jalur yang sama dengan produksi: `AnalysisService.run` dengan katalog uji.
 *
 * Harapan di sini DITULIS DARI ATURAN, bukan disalin dari keluaran: segmen pengganti seukuran pipa
 * lama karena ia disambung ke pipa lama di kedua ujungnya, dan pekerjaan pembuangan memakai pipa
 * pembuangan karena kelas AW bukan pipa air kotor.
 */
import {
  DEFAULT_LOCALE,
  type Product,
  type Recommendation,
  type RequirementState,
  type SpecValue,
} from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { RuleInputError } from '@snouty/engineering';
import { mergeRequirement, type FieldUpdate } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import type { TraceToSave } from '../domain/recommendation.repository.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-11-13T02:00:00.000Z';
const verified = (value: string) => ({ provenance: 'VERIFIED', value }) as unknown as SpecValue;
const unavailable = { provenance: 'UNAVAILABLE', value: null } as unknown as SpecValue;

let seq = 0;
function product(family: string, category: string, name: string, sizes: string[]): Product {
  seq += 1;
  return {
    id: `P${String(seq).padStart(25, '0')}`,
    sku: `SKU-${seq}`,
    name,
    family,
    category,
    description: '',
    status: 'active',
    sizes,
    material: verified('uPVC'),
    standard: unavailable,
    pressureClass: unavailable,
    rodLength: unavailable,
    jointType: unavailable,
    application: unavailable,
    sourceDocument: 'Export ERP uji',
    sourcePage: 1,
    catalogVersionId: 'V'.repeat(26),
    imageUrl: null,
  } as unknown as Product;
}

const CATALOG: readonly Product[] = [
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 1" x 4 Meter', ['1"']),
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 3/4" x 4 Meter', ['3/4"']),
  product('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Putih AW 1/2" x 4 Meter', ['1/2"']),
  product('FITTING PVC', 'FITTING', 'Socket - W 1"', ['1"']),
  product('FITTING PVC', 'FITTING', 'Tee TS - W 1"', ['1"']),
  product('PVC D', 'PIPA AIR BUANGAN', 'Pipa (Plain End) Abu D 4" x 4 Meter', ['4"']),
  product('PVC D', 'PIPA AIR BUANGAN', 'Pipa (Plain End) Abu D 3" x 4 Meter', ['3"']),
  product('PVC D', 'PIPA AIR BUANGAN', 'Pipa (Plain End) Abu D 2" x 4 Meter', ['2"']),
  product('FITTING PVC', 'FITTING', 'Socket - D 3"', ['3"']),
  product('FITTING PVC', 'FITTING', 'Bell Long TY - D 4" x 4"', ['4"']),
];

function stateOf(fields: ReadonlyArray<readonly [string, unknown]>): RequirementState {
  return withCompleteness(
    mergeRequirement(
      emptyRequirementState(T0),
      fields.map(
        ([path, value]) => ({ path, value, source: 'user_stated' }) as unknown as FieldUpdate,
      ),
      T0,
    ).state,
  );
}

async function analyse(
  state: RequirementState,
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
        CATALOG.filter(
          (p) =>
            p.family === family &&
            (categoryIncludes === undefined || p.category.includes(categoryIncludes)),
        ),
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

const HOUSE: ReadonlyArray<readonly [string, unknown]> = [
  ['building.type', 'residential'],
  ['building.floors', 2],
  ['building.dimensions', { lengthM: 12, widthM: 5, landLengthM: 15, landWidthM: 7 }],
  ['fixtures.bathrooms', 2],
  ['fixtures.basins', 1],
  ['fixtures.kitchens', 1],
];

describe('ganti-sebagian-hdpe-25mm (temuan 1)', () => {
  it('segmen 25 mm dengan sambungan transisi HDPE, bukan 1" dengan sok PVC AW', async () => {
    const { rec } = await analyse(
      stateOf([
        ...HOUSE,
        ['water.source', 'municipal'],
        ['water.installationType', 'clean_water'],
        ['water.workType', 'replace_partial'],
        ['water.existingPipeMaterial', 'hdpe'],
        ['water.existingMainSize', '25 mm'],
        ['water.replacementLengthM', 3],
      ]),
    );
    const segment = rec.systemLines.find((l) => l.name === 'Segmen yang diganti');
    expect(segment?.size).toBe('25 mm');
    const joint = rec.bom.find((b) => /kopling/i.test(b.item));
    expect(joint).toMatchObject({ size: '25 mm', quantity: 2 });
    expect(rec.bom.some((b) => /Sok PVC AW/.test(b.item))).toBe(false);
    // Pipa segmennya seukuran pipa lama, dan panjangnya 3 m — bukan seluruh jalur.
    const pipe = rec.bom.find((b) => /^Pipa /.test(b.item));
    expect(pipe).toMatchObject({ item: 'Pipa HDPE', size: '25 mm', netLengthM: 3 });
  });
});

describe('ganti-sebagian-pembuangan (temuan 2)', () => {
  const DRAINAGE = stateOf([
    ...HOUSE,
    ['water.installationType', 'drainage'],
    ['water.workType', 'replace_partial'],
    ['water.existingPipeMaterial', 'pvc'],
    ['water.existingMainSize', '3"'],
    ['water.replacementLengthM', 3],
    ['water.replacedLine', 'soil'],
  ]);

  it('sumber air tidak diminta untuk pekerjaan yang hanya pembuangan', () => {
    expect(DRAINAGE.missingInformation).not.toContain('water.source');
  });

  it('segmen PVC D 3": tidak ada baris air bersih di antara material renovasinya', async () => {
    const { rec } = await analyse(DRAINAGE);
    const segment = rec.systemLines.find((l) => l.name === 'Segmen yang diganti');
    expect(segment?.size).toBe('3"');
    const renovationRows = rec.bom.filter((b) => /sambung ke pipa lama/i.test(b.item));
    expect(renovationRows.length).toBeGreaterThan(0);
    for (const row of renovationRows) {
      expect(row.item).toContain('PVC D');
      expect(row.system).toBe('soil');
    }
    expect(rec.bom.some((b) => /AW \(sambung|Sok PVC AW/.test(b.item))).toBe(false);
  });
});

describe('nol-titik-air (temuan 3)', () => {
  const ZERO = stateOf([
    ...HOUSE.filter(([path]) => !path.startsWith('fixtures.')),
    ['fixtures.bathrooms', 0],
    ['fixtures.basins', 0],
    ['fixtures.kitchens', 0],
    ['water.source', 'municipal'],
    ['water.installationType', 'clean_water'],
  ]);

  it('rumah tanpa satu pun titik air: ditanya, bukan dihitung', () => {
    // Tidak ada yang bisa diukur untuk nol titik air: itu data yang kurang, bukan gangguan layanan.
    expect(ZERO.missingInformation.length).toBeGreaterThan(0);
    expect(ZERO.missingInformation).toContain('fixtures.bathrooms');
  });

  it('kalau tetap dihitung, galatnya galat masukan — bukan layanan tidak tersedia', async () => {
    await expect(analyse(ZERO)).rejects.toSatisfy(
      (error: unknown) => error instanceof RuleInputError,
    );
  });
});
