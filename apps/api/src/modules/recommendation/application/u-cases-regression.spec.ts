/**
 * Review putaran 3 (audit live 2026-10-13): kasus U1/U2/U3 dari pengguna, jalur lengkap
 * `AnalysisService.run` → rekomendasi → BOQ, dengan katalog ERP Pralon yang ada di repo.
 *
 *   U1: 1 lantai, 10 × 6 m, tanah 15 × 8 m, 1 KM, 1 dapur, 0 wastafel, toren atap.
 *   U2: 3 lantai, 10 × 8 m, tanah 20 × 10 m, 4 KM, 2 wastafel, 1 dapur, pompa sumur.
 *   U3: 2 lantai, 2 × 2 m, 6 KM, PDAM; dapur dan wastafel tidak dijawab.
 */
import { readFileSync } from 'node:fs';
import {
  boqFrom,
  DEFAULT_LOCALE,
  parsePipeSize,
  samePipeSize,
  type Product,
  type Recommendation,
  type RequirementState,
} from '@snouty/shared-types';
import { beforeAll, describe, expect, it } from 'vitest';
import { mergeRequirement, type FieldUpdate } from '../../context/domain/context-merger.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import { parseCsvCatalog } from '../../product-catalog/infrastructure/csv-catalog-import.adapter.js';
import { AnalysisService } from './analysis.service.js';

const T0 = '2026-10-13T00:00:00.000Z';
const CSV = new URL(
  '../../../../../../data/catalog/2026-10-06-erp/snouty_catalog_import_inch.csv',
  import.meta.url,
);

function catalog(): readonly Product[] {
  const source = parseCsvCatalog(readFileSync(CSV, 'utf8'), 'uji', 'uji');
  const text = (value: string | readonly string[] | undefined) =>
    typeof value === 'string' ? value : undefined;
  const spec = (value: string | undefined) =>
    (value
      ? { provenance: 'VERIFIED', value }
      : { provenance: 'UNAVAILABLE', value: null }) as never;
  return source.rows.map((row) => {
    const v = row.values;
    return {
      id: text(v['sku'])!,
      sku: text(v['sku'])!,
      name: text(v['name'])!,
      family: text(v['family'])!,
      category: text(v['category']) ?? '',
      description: '',
      status: 'active',
      sizes: (text(v['sizes']) ?? '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `${s}"`),
      material: spec(text(v['material'])),
      standard: spec(text(v['standard'])),
      pressureClass: spec(text(v['pressure_class'])),
      rodLength: spec(text(v['rod_length'])),
      jointType: spec(text(v['joint_type'])),
      application: spec(text(v['application'])),
      sourceDocument: 'uji',
      sourcePage: 1,
      catalogVersionId: 'V'.repeat(26),
      imageUrl: null,
    } as unknown as Product;
  });
}

let CATALOG: readonly Product[] = [];
beforeAll(() => {
  CATALOG = catalog();
});

async function analyse(state: RequirementState): Promise<Recommendation> {
  let saved: Recommendation | null = null;
  const service = new AnalysisService(
    { findVersionById: async () => null } as never,
    { save: async (rec: Recommendation) => void (saved = rec) } as never,
    { markSolutionReady: async () => undefined } as never,
    null,
    {
      activeVersion: async () =>
        ({ id: 'V'.repeat(26), label: 'uji', kind: 'pralon', status: 'active' }) as never,
      listProducts: async () => ({ items: [], nextCursor: null }),
      candidatesFor: async ({ family, size, categoryIncludes }) =>
        CATALOG.filter(
          (p) =>
            p.family === family &&
            (categoryIncludes === undefined || p.category.includes(categoryIncludes)) &&
            (size === null ||
              size === undefined ||
              p.sizes.some((label) => {
                const parsed = parsePipeSize(label);
                return parsed !== null && samePipeSize(parsed, size);
              })),
        ),
    },
  );
  await service.run('C'.repeat(26), 'S'.repeat(26), state, [], T0, undefined, DEFAULT_LOCALE);
  return saved!;
}

const user = (path: FieldUpdate['path'], value: unknown): FieldUpdate => ({
  path,
  value,
  source: 'user_stated',
});
const stateOf = (updates: FieldUpdate[]) =>
  withCompleteness(mergeRequirement(emptyRequirementState(T0), updates, T0).state);

const U1 = stateOf([
  user('building.type', 'residential'),
  user('building.floors', 1),
  user('building.dimensions', { lengthM: 10, widthM: 6, landLengthM: 15, landWidthM: 8 }),
  user('fixtures.bathrooms', 1),
  user('fixtures.kitchens', 1),
  user('fixtures.basins', 0),
  user('water.source', 'rooftop_tank'),
  user('water.installationType', 'both'),
]);
const U2 = stateOf([
  user('building.type', 'residential'),
  user('building.floors', 3),
  user('building.dimensions', { lengthM: 10, widthM: 8, landLengthM: 20, landWidthM: 10 }),
  user('fixtures.bathrooms', 4),
  user('fixtures.basins', 2),
  user('fixtures.kitchens', 1),
  user('water.source', 'pump'),
  user('water.installationType', 'both'),
]);
const U3 = stateOf([
  user('building.type', 'residential'),
  user('building.floors', 2),
  user('building.dimensions', { lengthM: 2, widthM: 2 }),
  user('fixtures.bathrooms', 6),
  user('water.source', 'municipal'),
  user('water.installationType', 'both'),
]);

const rowsOf = (rec: Recommendation) => boqFrom(rec).sections.flatMap((s) => s.rows);

describe('U1 — rumah 1 lantai, toren atap', () => {
  it('pipa ¾" dibulatkan sekali per SKU: 48 m + 10% = 52,8 m ÷ 4 m → 14 batang (4a)', async () => {
    const rec = await analyse(U1);
    const pipe = rowsOf(rec).find((r) => r.kind === 'pipe' && r.size === '3/4"')!;
    expect(pipe.netLengthM).toBe(48);
    expect(pipe.quantity).toBe(14);
  });

  it('tanpa tee sisa (4b) dan tanpa fitting pipa tegak (4c)', async () => {
    const rows = rowsOf(await analyse(U1));
    expect(rows.some((r) => /^Tee/.test(r.productName ?? r.item))).toBe(false);
    expect(rows.some((r) => /45°/.test(r.item))).toBe(false);
  });

  it('pembuangan: Y per alat (4g), sambungan + topi ventilasi, sok/dop/lem (4f)', async () => {
    const soil = boqFrom(await analyse(U1)).sections.find((s) => s.system === 'soil')!.rows;
    expect(soil.find((r) => r.purpose === 'Y-branch air kotor')!.quantity).toBe(1);
    expect(soil.some((r) => r.purpose === 'Sambungan ventilasi air kotor')).toBe(true);
    expect(soil.some((r) => r.purpose === 'Topi ventilasi air kotor')).toBe(true);
    expect(soil.filter((r) => r.pending).map((r) => r.item)).toEqual(['Sok', 'Dop', 'Lem PVC']);
  });

  it('toren atap 1 lantai kurang tekanan: pompa pendorong dengan pilihan dudukan toren (1d)', async () => {
    const needs = (await analyse(U1)).needs ?? [];
    const booster = needs.find((n) => n.kind === 'booster_pump')!;
    expect(booster.minimumStandM).toBeGreaterThan(1);
    expect(needs.some((n) => n.kind === 'well_pump')).toBe(false);
  });
});

describe('U2 — rumah 3 lantai, pompa sumur', () => {
  it('satu pompa: sumur + pompa, tanpa pompa pendorong kedua (1a); kedalaman 6 m perkiraan (1b)', async () => {
    const needs = (await analyse(U2)).needs ?? [];
    expect(needs.filter((n) => /pump/.test(n.kind)).map((n) => n.kind)).toEqual(['well_pump']);
    expect(needs.find((n) => n.kind === 'well_pump')).toMatchObject({
      wellDepthM: 6,
      wellDepthAssumed: true,
    });
  });

  it('Y air kotor = 4 kloset, tidak ditambah per lantai atas (4g)', async () => {
    const soil = boqFrom(await analyse(U2)).sections.find((s) => s.system === 'soil')!.rows;
    expect(soil.find((r) => r.purpose === 'Y-branch air kotor')!.quantity).toBe(4);
  });
});

describe('semua kasus — status katalog hanya untuk baris tanpa SKU (putaran 4, 5a–5c)', () => {
  it.each([
    ['U1', U1],
    ['U2', U2],
    ['U3', U3],
  ])('%s', async (_name, state) => {
    for (const row of rowsOf(await analyse(state))) {
      const label = row.purpose ?? row.item;
      // Ber-SKU → tanpa status (dulu "LIHAT DOKUMEN TEKNIS" juga di Elbow Abu Ts); tanpa SKU → status.
      expect(row.productName === undefined, label).toBe(row.availability !== undefined);
      // Nama katalog tanpa spasi sebelum tanda inci (Socket DV 2 ").
      expect(row.productName ?? '', label).not.toMatch(/\s"/);
      if (row.item === 'Lem PVC') expect(row.availability, label).toBe('ask_pralon');
      if (row.item === 'Stop kran') expect(row.availability, label).toBe('not_in_catalog');
    }
  });

  it('fitting Ts ber-SKU di U1 tidak lagi bertanda dokumen teknis', async () => {
    const elbow = rowsOf(await analyse(U1)).find((r) => r.productName === 'Elbow Abu Ts 3/4"')!;
    expect(elbow.availability).toBeUndefined();
  });
});

describe('U3 — 2 × 2 m untuk 6 kamar mandi', () => {
  it('tetap dihitung, dengan catatan data di luar kewajaran (2); wastafel dan dapur tercatat sebagai asumsi (3b)', async () => {
    const rec = await analyse(U3);
    const text = rec.assumptions.map((a) => a.text);
    expect(text.some((t) => t.startsWith('Data di luar kewajaran, mohon diverifikasi'))).toBe(true);
    expect(rec.assumptions.map((a) => a.assumptionId)).toEqual(
      expect.arrayContaining(['HOUSE_BASINS_0', 'HOUSE_KITCHEN_1']),
    );
  });
});

describe('U1 — tekanan di meteran untuk pipa pengisi toren (5b)', () => {
  it('dihitung dari muka air toren + kehilangan pipa pengisi, tampil sebagai baris sistem', async () => {
    const rec = await analyse(U1);
    const line = rec.systemLines.find((l) => l.name === 'Tekanan untuk mengisi toren')!;
    // Muka air toren 1 × 3,5 + 1 = 4,5 m ≈ 0,44 bar tanpa kehilangan; dengan kehilangan lebih besar.
    expect(Number(line.size.replace(' bar', '').replace(',', '.'))).toBeGreaterThan(0.44);
    expect(line.reason).toContain('Supaya toren terisi');
  });
});
