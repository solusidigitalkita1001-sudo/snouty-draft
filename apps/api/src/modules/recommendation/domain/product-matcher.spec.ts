/**
 * P7-03a — invarian C-2 (kartu produk hanya dari baris katalog) dan tiga matchState.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '@snouty/shared-types';
import { matchProducts, requirementsFrom } from './product-matcher.js';

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

const REQUIREMENTS = requirementsFrom({
  mainSize: '1"',
  branchSize: '3/4"',
  fixtureSize: '1/2"',
  pipeFamily: 'PVC AW',
});

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
        name: 'Fitting Pralon',
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
        name: 'Fitting Pralon',
      }),
    ];
    const result = matchProducts(REQUIREMENTS, candidates);
    expect(result.products).toHaveLength(5);
    expect(result.unmatchedRoles).toEqual([]);
  });
});
