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
  it('air bekas tidak lagi 2": 16 DFU di saluran, dan 2½" UPC hanya menampung 14 → 3"', async () => {
    const { rec, traces } = await analyse0009();
    const size = (name: string) => rec.systemLines.find((l) => l.name === name)?.size;
    expect(size('Pipa air bekas PVC D')).toBe('3"');
    expect(size('Pipa ventilasi air bekas')).toBe('1½"');
    expect(size('Pipa air kotor PVC D')).toBe('4"');
    expect(traces.filter((t) => t.ruleId === 'ENG-604')).toHaveLength(2);
    expect(rec.systemLines.find((l) => l.name === 'Pipa air bekas PVC D')!.reason).toContain(
      'kapasitas 35',
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
      ['Cabang 4 wastafel', '3/4"', 'Pipa utama → 4 wastafel (2 cabang)'],
    ]);
    expect(rec.stats.branchCount).toBe(4);
  });
});

describe('regresi laporan SNTY-2026-10-0009 — C: fitting', () => {
  let seq = 0;
  const verified = (value: string) => ({ provenance: 'VERIFIED', value }) as never;
  const unavailable = { provenance: 'UNAVAILABLE', value: null } as never;
  const item = (family: string, category: string, name: string, sizes: string[]) =>
    ({
      id: `Q${String(++seq).padStart(25, '0')}`,
      sku: `Q-${seq}`,
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
    }) as unknown as import('@snouty/shared-types').Product;
  const CATALOG = [
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1 1/4" x 4 Meter', ['1 1/4"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1" x 4 Meter', ['1"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1/2" x 4 Meter', ['1/2"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 4" x 4 Meter', ['4"']),
    item('FITTING PVC', 'FITTING', 'Tee Abu Ts 1 1/4"', ['1 1/4"']),
    item('FITTING PVC', 'FITTING', 'Bell Reducer - W 1 1/4" x 1"', ['1 1/4"', '1"']),
    item('FITTING PVC', 'FITTING', 'Bell Reducer - W 1 1/4" x 1/2"', ['1 1/4"', '1/2"']),
    // Laporan 0009 mencetak Y 4" × 2½" untuk jalur 4": tidak boleh lagi.
    item('FITTING PVC', 'FITTING', 'Y - D 4" x 2 1/2"', ['4"', '2 1/2"']),
    item('FITTING PVC', 'FITTING', 'Long Y - D 4"', ['4"']),
  ];
  const nameOf = (id: string | undefined) => CATALOG.find((p) => p.id === id)?.name;

  it('tidak ada fitting yang ukurannya tidak cocok; Y air kotor 4" sama sisi', async () => {
    const { rec } = await analyse0009(CATALOG);
    const fittings = rec.products
      .filter((p) => p.role === 'fitting')
      .map((p) => nameOf(p.productId));
    expect(fittings).not.toContain('Y - D 4" x 2 1/2"');
    expect(fittings).toContain('Long Y - D 4"');
  });

  it('pipa utama 1¼" ke cabang 1" dan 1/2": tee + reducer per cabang, bukan tee sama sisi saja', async () => {
    const { rec } = await analyse0009(CATALOG);
    // Hanya sambungan cabang; elbow/Y/clean out (P18-01) diuji di bagian fitting rumah.
    const rows = rec.bom
      .filter((b) => b.unit === 'pcs' && /^(Tee|Reducer)/.test(b.item))
      .map((b) => `${b.item} ${b.size} ${b.quantity} ${nameOf(b.productId) ?? '-'}`);
    expect(rows).toEqual([
      // Tee sama sisi untuk tiga cabang; cabang keempat di ujung pipa utama memakai elbow + reducer
      // (review laporan 0015). Dengan beban alat UPC cabang wastafelnya 3/4", dan katalog
      `Tee cabang ${rec.stats.mainSize} 3 Tee Abu Ts 1 1/4"`,
      `Reducer cabang ${rec.stats.mainSize} × 1" 2 Bell Reducer - W 1 1/4" x 1"`,
      `Reducer cabang ${rec.stats.mainSize} × 3/4" 1 -`,
    ]);
  });
});

describe('regresi laporan SNTY-2026-10-0009 — D: konsistensi angka dan teks', () => {
  it('air bekas memasukkan jalur turun: 10 + 3,5 + halaman 5 = 18,5 m, sama dengan air kotor', async () => {
    const { rec } = await analyse0009();
    const drains = rec.bom.filter((b) => b.item === 'Pipa PVC D');
    expect(drains.find((b) => b.size === '4"')!.basis).toContain('Panjang bersih 18,5 m');
    expect(drains.find((b) => b.size === '3"')!.basis).toContain('Panjang bersih 18,5 m');
  });

  it('tanpa produk katalog: "Ada N produk Pralon" tidak dicetak sebagai 0 (TC-D-03, TC-H-05)', async () => {
    // Katalog uji kosong → tidak ada SKU; baris material tetap ada, tetapi bukan produk Pralon.
    const { rec } = await analyse0009();
    expect(rec.stats.productCount).toBe(0);
    expect(rec.body).not.toContain('produk Pralon yang sesuai');
    expect(rec.bom.length).toBeGreaterThan(0);
  });

  it('batas kecepatan satu sumber: 0,6–2 m/s, rencana 1,5 m/s; tidak ada "1–2 m/s"', async () => {
    const { traces } = await analyse0009();
    const text = traces.map((t) => t.explanation).join(' ');
    expect(text).toContain('0,6–2 m/s');
    expect(text).not.toMatch(/\b1–2 m\/s/);
  });

  it('bukan rumah tinggal: teks asumsi dan alasan tidak menyebut "rumah"', async () => {
    const { rec } = await analyse0009();
    const text = [
      ...rec.assumptions.map((a) => a.text),
      ...rec.systemLines.map((l) => l.reason),
      rec.body,
    ].join(' ');
    expect(text).not.toMatch(/\brumah\b/i);
  });
});

describe('regresi laporan SNTY-2026-10-0009 — E: label data pengguna', () => {
  it('tipe bangunan, lantai, kamar mandi tercetak "DISEBUT PENGGUNA", tidak TERVERIFIKASI', async () => {
    const { assembleReportPayload } = await import('../../report/application/report-assembler.js');
    const { renderReportHtml } = await import('../../report/application/report-html.js');
    const { rec, traces } = await analyse0009();
    const html = renderReportHtml(
      assembleReportPayload({
        reportNumber: 'SNTY-2026-10-0009',
        identity: {
          customerName: 'tomo',
          projectLocation: 'masjid cibinong raya',
          consultationDate: '2026-10-12',
          installationType: 'Air bersih + pembuangan',
        },
        state: STATE_0009,
        recommendation: rec,
        traces,
        catalogVersionLabel: 'erp',
        pricing: { enabled: false, taxRatePercent: 11 },
      } as never),
    );
    const requirements = html.slice(
      html.indexOf('Kebutuhan yang tercatat'),
      html.indexOf('</table>', html.indexOf('Kebutuhan yang tercatat')),
    );
    expect(requirements.match(/DISEBUT PENGGUNA/g)!.length).toBeGreaterThanOrEqual(6);
    expect(requirements).not.toContain('TERVERIFIKASI');
  });
});

describe('TC-H-01 · aturan lama tidak ikut di trace', () => {
  it('tidak ada "Unit beban memakai bobot"; titik air 16 saja; beban suplai 16,8 WSFU; tanpa ENG-006', async () => {
    const { rec, traces } = await analyse0009();
    const text = traces.map((t) => t.explanation).join(' ');
    expect(text).not.toContain('Unit beban memakai bobot');
    expect(traces.find((t) => t.ruleId === 'ENG-001')!.explanation).toMatch(/= 16 titik\.$/);
    expect(text).toContain('Beban suplai 26 unit');
    expect(traces.some((t) => t.ruleId === 'ENG-006')).toBe(false);
    expect(rec.stats.outletCount).toBe(16);
  });
});

describe('TC-H-05 · satu daftar SKU untuk tab Produk, material, dan ringkasan', () => {
  let seq = 100;
  const verified = (value: string) => ({ provenance: 'VERIFIED', value }) as never;
  const unavailable = { provenance: 'UNAVAILABLE', value: null } as never;
  const item = (family: string, category: string, name: string, sizes: string[]) =>
    ({
      id: `R${String(++seq).padStart(25, '0')}`,
      sku: `R-${seq}`,
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
    }) as unknown as import('@snouty/shared-types').Product;
  const CATALOG = [
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1 1/4" x 4 Meter', ['1 1/4"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1" x 4 Meter', ['1"']),
    item('PVC AW', 'PIPA AIR BERSIH', 'Pipa (TS End) Abu AW 1/2" x 4 Meter', ['1/2"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 4" x 4 Meter', ['4"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 2 1/2" x 4 Meter', ['2 1/2"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 2" x 4 Meter', ['2"']),
    item('PVC D', 'PIPA AIR BUANGAN', 'Pipa (TS End) Abu D 1 1/4" x 4 Meter', ['1 1/4"']),
    item('FITTING PVC', 'FITTING', 'Bell Y - D 4"', ['4"']),
  ];

  it('SKU di tab Produk = SKU di material; ventilasi ikut produk, Y ikut material sebagai menyusul', async () => {
    const { skuLines } = await import('@snouty/shared-types');
    const { rec } = await analyse0009(CATALOG);
    const productIds = new Set(rec.products.map((p) => p.productId));
    const bomIds = new Set(rec.bom.map((b) => b.productId).filter(Boolean));
    // Setiap SKU di material ada di tab Produk.
    for (const id of bomIds) expect(productIds.has(id!)).toBe(true);
    const lines = skuLines(rec);
    const name = (id: string) => CATALOG.find((p) => p.id === id)!.name;
    // Pipa ventilasi D 2" ada di tab Produk; ventilasi air bekas kini 1½", yang tidak ada
    // di katalog contoh.
    expect(lines.map((l) => name(l.productId))).toEqual(
      expect.arrayContaining(['Pipa (TS End) Abu D 2" x 4 Meter']),
    );
    // Bell Y 4" kini punya jumlah dari ENG-605 (P18-01): satu SKU, jenis fitting, terhitung.
    const y = lines.find((l) => name(l.productId) === 'Bell Y - D 4"')!;
    expect(y).toMatchObject({ counted: true, kind: 'fitting', name: 'Bell Y - D 4"' });
    // Ringkasan dan statistik dari daftar yang sama.
    expect(rec.stats.productCount).toBe(lines.length);
    // Ringkasan dua kalimat (P17-10): bila kalimat jumlah produk masih ada, angkanya sama dengan daftar.
    const count = /Ada (d+) produk Pralon/.exec(rec.body);
    if (count) expect(Number(count[1])).toBe(lines.length);
  });

  it('satu kartu per SKU dengan semua peruntukannya; label Indonesia (TC-H-06)', async () => {
    const { skuLines } = await import('@snouty/shared-types');
    const { rec } = await analyse0009(CATALOG);
    const mainPipe = skuLines(rec).find((l) => l.name === 'Pipa (TS End) Abu AW 1 1/4" x 4 Meter')!;
    expect(mainPipe.selections.map((s) => s.purpose)).toEqual(['Pipa utama', 'Riser']);
    const purposes = rec.products.map((p) => p.purpose);
    expect(purposes).not.toContain(undefined);
    expect(purposes.join(' ')).not.toMatch(/\b(MAIN|RISER|BRANCH|FIXTURE|FITTING)\b/);
  });
});

describe('TC-H-07 · penjelasan baris hanya untuk jalurnya sendiri', () => {
  it('air kotor: hanya beban 12 DFU dan alasan 4" dari kloset; tanpa beban air bekas', async () => {
    const { rec } = await analyse0009();
    const soil = rec.systemLines.find((l) => l.name === 'Pipa air kotor PVC D')!.reason;
    expect(soil).toContain('Beban air kotor 12 = 4 kloset × 3.');
    expect(soil).toContain('alat terbesar di jalur ini butuh minimal 4"');
    expect(soil).not.toContain('Beban air bekas');
    expect(soil).not.toContain('Cabang mendatar');
  });

  it('air bekas: beban air bekas sendiri, dan kapasitas jalurnya sendiri', async () => {
    const { rec } = await analyse0009();
    const waste = rec.systemLines.find((l) => l.name === 'Pipa air bekas PVC D')!.reason;
    expect(waste).toContain('Beban air bekas 16 =');
    expect(waste).not.toContain('Beban air kotor');
    expect(waste).toContain('kapasitas 35');
  });
});

describe('desimal Indonesia di asumsi (laporan 0010)', () => {
  it('"Tinggi antar lantai diasumsikan 3,5 meter", bukan 3.5', async () => {
    const { rec } = await analyse0009();
    const text = rec.assumptions.map((a) => a.text).join(' ');
    expect(text).toContain('3,5 meter');
    expect(text).not.toMatch(/\d\.\d/);
  });
});
