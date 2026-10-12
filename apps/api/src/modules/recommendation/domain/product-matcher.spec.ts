/**
 * P7-03a — invarian C-2 (kartu produk hanya dari baris katalog) dan tiga matchState.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '@snouty/shared-types';
import { fittingRequirement, matchProducts, requirementsFrom } from './product-matcher.js';

function product(over: Partial<Product> = {}): Product {
  const unavailable = { provenance: 'UNAVAILABLE', value: null } as const;
  return {
    id: '01JBPIPE0000000000000000AA',
    sku: 'PVC-AW-001',
    name: 'Pralon PVC AW',
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    description: 'Pipa air bersih bertekanan.',
    status: 'active',
    sizes: ['1/2"', '3/4"', '1"'],
    material: unavailable,
    standard: unavailable,
    pressureClass: unavailable,
    rodLength: unavailable,
    jointType: unavailable,
    application: unavailable,
    catalogVersionId: '01JBCATVER00000000000000AA',
    sourceDocument: 'Katalog produk Pralon 2026',
    sourcePage: 14,
    imageUrl: null,
    ...over,
  };
}

const REQUIREMENTS = [
  ...requirementsFrom({
    mainSize: '1"',
    branchSizes: ['3/4"'],
    fixtureSize: '1/2"',
    pipeFamily: 'PVC AW',
  }),
  // Tee cabang dicocokkan terpisah per ukuran cabang (laporan 0009); di sini satu tee sama sisi.
  fittingRequirement('1"', 'PVC AW', 'tee'),
];

describe('ProductMatcher', () => {
  it('katalog kosong: tidak ada satu pun kartu produk (invarian C-2)', () => {
    const result = matchProducts(REQUIREMENTS, []);
    expect(result.products).toEqual([]);
    expect(result.unmatchedRoles).toHaveLength(REQUIREMENTS.length);
  });

  it('ukuran tersedia → VERIFIED_SELECTED', () => {
    const result = matchProducts(REQUIREMENTS, [product()]);
    const main = result.products.find((p) => p.role === 'main');
    expect(main?.matchState).toBe('VERIFIED_SELECTED');
    expect(main?.productId).toBe('01JBPIPE0000000000000000AA');
  });

  it('ukuran belum terdaftar → SIZE_NEEDS_VALIDATION, produknya tetap tampil', () => {
    const result = matchProducts(REQUIREMENTS, [product({ sizes: ['1/2"'] })]);
    const main = result.products.find((p) => p.role === 'main');
    expect(main?.matchState).toBe('SIZE_NEEDS_VALIDATION');
    expect(main?.reason).toContain('perlu dikonfirmasi');
  });

  it('peran tanpa keluarga produk di katalog tidak dipaksakan ke produk lain', () => {
    // Hanya pipa yang ada; peran fitting harus tercatat unmatched, bukan memilih pipa.
    const result = matchProducts(REQUIREMENTS, [product()]);
    expect(result.unmatchedRoles).toEqual(['fitting']);
    expect(result.products.some((p) => p.role === 'fitting')).toBe(false);
  });

  it('produk nonaktif tidak pernah dipilih', () => {
    const result = matchProducts(REQUIREMENTS, [product({ status: 'discontinued' })]);
    expect(result.products).toEqual([]);
  });

  it('setiap kartu merujuk productId dari daftar kandidat, tidak pernah dikarang', () => {
    const candidates = [
      product(),
      product({
        id: '01JBFIT00000000000000000BB',
        family: 'PVC AW',
        category: 'FITTING · SNI',
        sku: 'FIT-1',
        name: 'Tee TS - W 1"',
      }),
    ];
    const ids = new Set(candidates.map((c) => c.id));
    for (const selected of matchProducts(REQUIREMENTS, candidates).products) {
      expect(ids.has(selected.productId)).toBe(true);
    }
  });

  it('mencocokkan kelima peran bila katalog lengkap', () => {
    const candidates = [
      product(),
      product({
        id: '01JBFIT00000000000000000BB',
        family: 'PVC AW',
        category: 'FITTING · SNI',
        sku: 'FIT-1',
        name: 'Tee TS - W 1"',
      }),
    ];
    const result = matchProducts(REQUIREMENTS, candidates);
    expect(result.products).toHaveLength(5);
    expect(result.unmatchedRoles).toEqual([]);
  });
});

describe('ProductMatcher v2 — katalog Pralon (docs/MATCHER_V2_PROPOSAL.md)', () => {
  const verified = (value: string) => ({ provenance: 'VERIFIED' as const, value });

  it('kandidat ganda dipilih deterministik: batang 4 m dulu, lalu varian baku, lalu SKU; sisanya alternatif', () => {
    const candidates = [
      product({
        id: '01JBVAR00000000000000000A1',
        sku: 'AW-6M',
        name: 'Pipa (Plain End) Abu AW 1/2" x 6 Meter',
        rodLength: verified('6 m'),
      }),
      product({
        id: '01JBVAR00000000000000000A2',
        sku: 'AW-4M-PIPPO',
        name: 'Pipa (TS End) Putih AW - PIPPO 1/2" x 4 Meter',
        rodLength: verified('4 m'),
      }),
      product({
        id: '01JBVAR00000000000000000A3',
        sku: 'AW-4M',
        name: 'Pipa (Plain End) Abu AW 1/2" x 4 Meter',
        rodLength: verified('4 m'),
      }),
      product({
        id: '01JBVAR00000000000000000A4',
        sku: 'AW-1M',
        name: 'Pipa (Plain End) Abu AW 1/2" x 1 Meter',
        rodLength: verified('1 m'),
      }),
    ];
    const [main] = matchProducts(
      [{ role: 'main', size: '1/2"', families: ['PVC AW'] }],
      candidates,
    ).products;
    expect(main?.productId).toBe('01JBVAR00000000000000000A3');
    expect(main?.matchState).toBe('VERIFIED_SELECTED');
    expect(main?.reason).toContain('batang 4 m');
    expect(main?.alternatives?.map((a) => a.productId)).toEqual([
      '01JBVAR00000000000000000A2',
      '01JBVAR00000000000000000A1',
      '01JBVAR00000000000000000A4',
    ]);
    // Urutan masukan tidak mengubah pilihan.
    const reversed = matchProducts(
      [{ role: 'main', size: '1/2"', families: ['PVC AW'] }],
      [...candidates].reverse(),
    );
    expect(reversed.products[0]?.productId).toBe('01JBVAR00000000000000000A3');
  });

  it('fitting: keluarga FITTING PVC dicari dulu; kelas D ditolak untuk pipa AW; kelas belum terverifikasi → SIZE_NEEDS_VALIDATION', () => {
    const fittingD = product({
      id: '01JBFITD0000000000000000D1',
      sku: 'TEE-D',
      name: 'Tee - D 3/4"',
      family: 'FITTING PVC',
      category: 'FITTING · TEE',
      sizes: ['3/4"'],
      pressureClass: verified('D'),
    });
    const fittingW = product({
      id: '01JBFITW0000000000000000W1',
      sku: 'TEE-W',
      name: 'Tee - W 3/4"',
      family: 'FITTING PVC',
      category: 'FITTING · TEE',
      sizes: ['3/4"'],
    });
    const fittingAW = product({
      id: '01JBFITA0000000000000000A1',
      sku: 'TEE-AW',
      name: 'Tee AW 3/4"',
      family: 'FITTING PVC',
      category: 'FITTING · TEE',
      sizes: ['3/4"'],
      pressureClass: verified('AW'),
    });
    const req = fittingRequirement('3/4"', 'PVC AW');
    expect(req.families).toEqual(['FITTING PVC', 'PVC AW']);
    expect(req.pressureClass).toBe('AW');

    const onlyD = matchProducts([req], [fittingD]);
    expect(onlyD.products).toEqual([]);
    // Satu-satunya kandidat berkelas VERIFIED D: tidak boleh dipasangkan ke pipa AW → peran kosong.
    expect(onlyD.unmatchedRoles).toEqual(['fitting']);
    const onlyW = matchProducts([req], [fittingW, fittingD]).products[0];
    expect(onlyW?.productId).toBe('01JBFITW0000000000000000W1');
    expect(onlyW?.matchState).toBe('SIZE_NEEDS_VALIDATION');
    expect(onlyW?.reason).toContain('belum terverifikasi');
    const withAW = matchProducts([req], [fittingW, fittingD, fittingAW]).products[0];
    expect(withAW?.productId).toBe('01JBFITA0000000000000000A1');
    expect(withAW?.matchState).toBe('VERIFIED_SELECTED');
  });

  it('katalog tanpa keluarga fitting (sample): fallback keluarga pipa + kategori FITTING tetap bekerja', () => {
    const sampleFitting = product({
      id: '01JBSMP00000000000000000F1',
      sku: 'DEV-FIT-TEE',
      name: 'CONTOH Tee PVC AW 3/4"',
      category: 'FITTING · SNI',
      sizes: ['3/4"'],
    });
    const [fitting] = matchProducts(
      [fittingRequirement('3/4"', 'PVC AW')],
      [product(), sampleFitting],
    ).products;
    expect(fitting?.productId).toBe('01JBSMP00000000000000000F1');
    expect(fitting?.role).toBe('fitting');
  });

  it('ukuran mm dicocokkan dalam satuan yang sama; 2" tidak pernah menemukan 50 mm', () => {
    const hdpe = product({
      id: '01JBHDPE0000000000000000H1',
      sku: 'HDPE-50',
      name: 'Pipa HDPE PE 100 PN-10 50 mm',
      family: 'HDPE',
      category: 'PIPA HDPE',
      sizes: ['50 mm', '63 mm'],
    });
    expect(
      matchProducts([{ role: 'main', size: '50 mm', families: ['HDPE'] }], [hdpe]).products[0]
        ?.matchState,
    ).toBe('VERIFIED_SELECTED');
    expect(
      matchProducts([{ role: 'main', size: '2"', families: ['HDPE'] }], [hdpe]).products[0]
        ?.matchState,
    ).toBe('SIZE_NEEDS_VALIDATION');
  });
});

describe('fitting tanpa pengganti (temuan laporan SNTY-2026-10-0002)', () => {
  it('reducer berukuran sama tidak pernah dipilih; fitting ukuran lain bukan pengganti', () => {
    const sameReducer = product({
      id: '01JBFIT00000000000000000AA',
      family: 'FITTING PVC',
      category: 'FITTING',
      name: 'Bell Reducer - W 3/4" x 3/4"',
      sizes: ['3/4"'],
    });
    const otherSize = product({
      id: '01JBFIT00000000000000000BB',
      family: 'FITTING PVC',
      category: 'FITTING',
      name: 'Tee TS - W 1"',
      sizes: ['1"'],
    });
    const result = matchProducts([fittingRequirement('3/4"', 'PVC AW')], [sameReducer, otherSize]);
    expect(result.products).toEqual([]);
    expect(result.unmatchedRoles).toEqual(['fitting']);
  });
});

describe('jenis dan ukuran utama fitting (temuan laporan SNTY-2026-10-0007)', () => {
  const fitting = (id: string, name: string, sizes: string[], family = 'FITTING PVC') =>
    product({ id, sku: id, name, family, category: 'FITTING', sizes });

  it('tee cabang tidak pernah terisi tutup pipa atau tee keran', () => {
    const picked = matchProducts(
      [fittingRequirement('1/2"', 'PVC AW', 'tee')],
      [
        fitting('CAP', 'Cap - W 1/2"', ['1/2"']),
        fitting('FAUCET', 'Faucet Tee - W 1/2"', ['1/2"']),
        fitting('TEE', 'Tee Abu Ts 1/2"', ['1/2"']),
      ],
    ).products;
    expect(picked.map((p) => p.productId)).toEqual(['TEE']);
  });

  it('Y pembuangan 4" memakai ukuran utama nama — "Long TY 10" x 4"" bukan fitting 4"', () => {
    const candidates = [
      fitting('TY-10X4', 'Long TY - D 10" x 4"', ['10"', '4"']),
      fitting('DOUBLE', 'Double Long TY - D 4"', ['4"']),
      fitting('TY-4', 'Bell Long TY - D 4" x 4"', ['4"']),
    ];
    const picked = matchProducts([fittingRequirement('4"', 'PVC D', 'branch_y')], candidates);
    expect(picked.products.map((p) => p.productId)).toEqual(['TY-4']);
    // Tanpa Y berukuran utama 4" → kosong, bukan fitting ukuran lain.
    expect(
      matchProducts([fittingRequirement('4"', 'PVC D', 'branch_y')], candidates.slice(0, 2))
        .unmatchedRoles,
    ).toEqual(['fitting']);
  });
});

describe('kedua ukuran fitting harus persis (temuan laporan 0009)', () => {
  const fitting = (id: string, name: string, sizes: string[]) =>
    product({ id, sku: id, name, family: 'FITTING PVC', category: 'FITTING', sizes });

  it('Y 4" sama sisi: "Y 4" x 2 1/2"" ditolak, tidak ada ukuran terdekat', () => {
    const candidates = [
      fitting('Y-REDUCING', 'Y - D 4" x 2 1/2"', ['4"', '2 1/2"']),
      fitting('Y-EQUAL', 'Long Y - D 4"', ['4"']),
    ];
    expect(
      matchProducts([fittingRequirement('4"', 'PVC D', 'branch_y')], candidates).products.map(
        (p) => p.productId,
      ),
    ).toEqual(['Y-EQUAL']);
    expect(
      matchProducts([fittingRequirement('4"', 'PVC D', 'branch_y')], candidates.slice(0, 1))
        .unmatchedRoles,
    ).toEqual(['fitting']);
  });

  it('tee reduksi 1 1/4" × 3/4" dipilih menurut kedua ukurannya; reducer dikenali sebagai reducer', () => {
    const candidates = [
      fitting('TEE-EQUAL', 'Tee Abu Ts 1 1/4"', ['1 1/4"']),
      fitting('TEE-RED', 'Tee Abu Ts 1 1/4" x 3/4"', ['1 1/4"', '3/4"']),
      fitting('RED', 'Bell Reducer - W 1 1/4" x 3/4"', ['1 1/4"', '3/4"']),
    ];
    const [tee] = matchProducts(
      [fittingRequirement('1 1/4"', 'PVC AW', 'tee', '3/4"')],
      candidates,
    ).products;
    expect(tee).toMatchObject({ productId: 'TEE-RED', size: '1 1/4" × 3/4"' });
    const [reducer] = matchProducts(
      [fittingRequirement('1 1/4"', 'PVC AW', 'reducer', '3/4"')],
      candidates,
    ).products;
    expect(reducer?.productId).toBe('RED');
  });
});
