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
import { extractionToUpdates } from '../../context/application/extraction-to-updates.js';
import { bomQuantityMismatches, quantityInResult } from '../../report/domain/boq-consistency.js';
import { withCompleteness } from '../../context/domain/completeness.js';
import { understoodReply } from '../../context/application/message-pipeline.js';
import {
  outlierAnswer,
  outlierQuestions,
  pendingOutliers,
} from '../../context/domain/plausibility.js';
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

describe('50-lantai-pdam (temuan 4)', () => {
  const TALL: ReadonlyArray<readonly [string, unknown]> = [
    ['building.type', 'residential'],
    ['building.floors', 50],
    ['fixtures.bathrooms', 1],
    ['fixtures.basins', 1],
    ['fixtures.kitchens', 1],
    ['water.source', 'municipal'],
    ['water.installationType', 'clean_water'],
  ];

  it('rumah tinggal 50 lantai ditanya dulu: itu bukan rumah tinggal, atau angkanya salah', () => {
    const issues = pendingOutliers(stateOf(TALL));
    expect(issues.map((i) => i.code)).toContain('floors_for_residential');
    // Kartunya bisa membetulkan jumlah lantainya, bukan ukuran bangunan.
    const card = outlierQuestions(issues, 'id').find(
      (q) => q.id === 'outlier.floors_for_residential',
    );
    expect(card?.inputs?.map((i) => i.key)).toEqual(['value']);
    expect(outlierAnswer({ id: 'outlier.floors_for_residential', option: 'value=3' })).toEqual({
      update: { path: 'building.floors', value: 3, source: 'user_stated' },
    });
  });

  it('tekanan 18 bar di meteran PDAM dibawa dengan peringatan dan jalan keluarnya', async () => {
    const { rec } = await analyse(
      stateOf([...TALL, ['building.dimensions', { lengthM: 12, widthM: 5 }]]),
    );
    const line = rec.systemLines.find((l) => /meteran PDAM|water meter/.test(l.name));
    expect(line?.size).toMatch(/bar$/);
    // Angka yang tidak ada di jaringan PDAM mana pun tidak dicetak tanpa catatan.
    expect(line?.reason).toMatch(/melebihi batas tekanan statik/);
    expect(line?.reason).toMatch(/tangki bawah|dipompa/);
    expect(line?.reason).toMatch(/zona/);
    // Tekanan kerja pipanya belum tercatat di data mana pun — itu disebut, bukan dikarang.
    expect(line?.reason).toMatch(/belum tercatat/);
  });
});

describe('boq-konsisten-dengan-hitungan (temuan 6)', () => {
  it('segmen yang diganti: hitungan dan jumlah belinya satu angka, sepanjang segmen', async () => {
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
    const pipe = rec.bom.find((b) => /^Pipa /.test(b.item))!;
    // Hitungannya menjelaskan segmen 3 m, bukan seluruh jalur: pipa HDPE 25 mm belum ada di
    // katalog uji, jadi jumlahnya dalam meter — 3 m, angka yang sama dengan panjang segmennya.
    expect(pipe.calc?.working).toContain('3 m');
    expect(quantityInResult(pipe.calc!.result)).toBe(pipe.quantity);
    expect(pipe.quantity).toBe(3);
    expect(pipe.netLengthM).toBe(3);
  });

  it('rumah air bersih + pembuangan: tidak ada baris yang jumlahnya beda dengan hitungannya', async () => {
    const { rec } = await analyse(
      stateOf([...HOUSE, ['water.source', 'municipal'], ['water.installationType', 'both']]),
    );
    expect(bomQuantityMismatches(rec.bom)).toEqual([]);
  });
});

describe('panjang-ganti-melebihi-jalur (temuan 7)', () => {
  it('100 m pada jalur 22,5 m: dikatakan mencakup seluruh jalur, dengan tawaran ganti semua', async () => {
    const { rec } = await analyse(
      stateOf([
        ...HOUSE,
        ['water.source', 'municipal'],
        ['water.installationType', 'clean_water'],
        ['water.workType', 'replace_partial'],
        ['water.existingPipeMaterial', 'pvc'],
        ['water.existingMainSize', '1"'],
        ['water.replacementLengthM', 100],
      ]),
    );
    // "Ganti sebagian 100 %" bukan penggantian sebagian.
    expect(rec.body).not.toMatch(/100 %/);
    expect(rec.body).not.toMatch(/hanya segmen/i);
    expect(rec.body).toMatch(/seluruh jalur/);
    expect(rec.body).toMatch(/ganti semua pipa/i);
    // Yang bisa diubah pengguna ditunjuk: panjang yang diganti.
    expect(rec.assumptions.some((a) => a.fieldPath === 'water.replacementLengthM')).toBe(true);
  });
});

describe('wastafel-diisi-diam-diam (temuan 8)', () => {
  const NO_BASINS = stateOf([
    ...HOUSE.filter(([path]) => path !== 'fixtures.basins'),
    ['water.source', 'municipal'],
    ['water.installationType', 'clean_water'],
  ]);

  it('2 kamar mandi tanpa jumlah wastafel: anggapannya terlihat, bisa diperbaiki, dan disebut', async () => {
    const { rec } = await analyse(NO_BASINS);
    const basin = rec.assumptions.find((a) => a.assumptionId === 'HOUSE_BASINS_PER_BATHROOM_1');
    expect(basin?.fieldPath).toBe('fixtures.basins');
    // Dan balasan chat menyebutnya, bukan mengisinya diam-diam.
    const reply = understoodReply(NO_BASINS, 'cta', 'id', undefined, true)!;
    expect(reply).toContain('1 wastafel per kamar mandi');
    // Yang di bawah balasan itu tombol susun rekomendasi, bukan pertanyaan.
    expect(reply).not.toContain('pertanyaan di bawah');
  });
});

describe('alat-yang-disebut-hilang (temuan 9)', () => {
  it('"ada mesin cuci dan keran taman" tercatat sebagai dua field, bukan hilang', () => {
    const updates = extractionToUpdates({}, 'ada mesin cuci dan keran taman');
    const of = (path: string) => updates.find((u) => u.path === path)?.value;
    expect(of('fixtures.washingMachines')).toBe(1);
    expect(of('fixtures.outdoorTaps')).toBe(1);
    // Keran taman bukan jumlah titik air rumah, dan mesin cuci bukan kamar mandi.
    expect(of('fixtures.outletCount')).toBeUndefined();
  });

  it('water heater dan floor drain balkon juga terbaca', () => {
    const updates = extractionToUpdates({}, 'pakai 2 water heater dan floor drain di balkon');
    const of = (path: string) => updates.find((u) => u.path === path)?.value;
    expect(of('fixtures.waterHeaters')).toBe(2);
    expect(of('fixtures.balconyFloorDrains')).toBe(1);
  });

  const WITH_APPLIANCES = stateOf([
    ...HOUSE,
    ['water.source', 'municipal'],
    ['water.installationType', 'both'],
    ['fixtures.washingMachines', 1],
    ['fixtures.outdoorTaps', 1],
    ['fixtures.waterHeaters', 1],
    ['fixtures.balconyFloorDrains', 1],
  ]);

  it('mesin cuci menambah beban suplai dan beban air bekas, bukan diabaikan', async () => {
    const { rec, traces } = await analyse(WITH_APPLIANCES);
    const plain = stateOf([
      ...HOUSE,
      ['water.source', 'municipal'],
      ['water.installationType', 'both'],
    ]);
    const base = await analyse(plain);
    const wsfu = (list: readonly TraceToSave[]) =>
      list.find((t) => t.ruleId === 'ENG-701')?.output as { wsfu?: number } | undefined;
    // UPC Tabel A 103.1: mesin cuci 4 WSFU; keran taman punya angkanya sendiri.
    expect(wsfu(traces)?.wsfu).toBeGreaterThan(wsfu(base.traces)?.wsfu ?? 0);
    // UPC 702.1: mesin cuci 3 DFU + floor drain 2 DFU di jalur air bekas.
    const dfu = (list: readonly TraceToSave[]) =>
      list.find((t) => t.ruleId === 'ENG-601')?.output as { wasteDfu?: number } | undefined;
    expect(dfu(traces)?.wasteDfu).toBe((dfu(base.traces)?.wasteDfu ?? 0) + 5);
    // Water heater tercatat, dan jalur air panasnya dikatakan belum dihitung.
    expect(
      rec.assumptions.some(
        (a) => a.fieldPath === 'fixtures.waterHeaters' && /air panas/.test(a.text),
      ),
    ).toBe(true);
  });

  it('alat yang disebut ikut disebut balik di balasan chat', () => {
    const reply = understoodReply(WITH_APPLIANCES, 'cta', 'id', undefined, true)!;
    expect(reply).toContain('mesin cuci');
    expect(reply).toContain('keran luar');
  });
});
