/**
 * Tes unit pemetaan — tanpa database, karena yang diuji di sini adalah keputusan
 * pemetaan, bukan perilaku MySQL.
 */
import { describe, expect, it } from 'vitest';
import {
  toCatalogVersion,
  toCompatibleFitting,
  toProducts,
  type ProductRow,
} from './catalog.mapper.js';

const row: ProductRow = {
  id: 'P1',
  catalogVersionId: 'V1',
  sku: 'AW-A',
  name: 'Pralon PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: null,
  status: 'active',
  sourceDocument: 'Katalog produk Pralon 2026',
  sourcePage: 14,
  imageUrl: null,
};

describe('toProducts', () => {
  it('mengisi keenam field spesifikasi walaupun tidak ada satu pun barisnya', () => {
    const [product] = toProducts([row], [], []);

    expect(product?.material).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(product?.standard).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(product?.pressureClass).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(product?.rodLength).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(product?.jointType).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(product?.application).toEqual({ value: null, provenance: 'UNAVAILABLE' });
  });

  it('tidak mengarang teks untuk deskripsi yang kosong', () => {
    const [product] = toProducts([row], [], []);

    expect(product?.description).toBe('');
  });

  it('memetakan ukuran ke produknya masing-masing, tanpa tertukar', () => {
    const second: ProductRow = { ...row, id: 'P2', sku: 'AW-B' };
    const mapped = toProducts(
      [row, second],
      [
        { productId: 'P2', sizeLabel: '1"' },
        { productId: 'P1', sizeLabel: '3/4"' },
      ],
      [],
    );

    expect(mapped[0]?.sizes).toEqual(['3/4"']);
    expect(mapped[1]?.sizes).toEqual(['1"']);
  });

  it('melempar saat status produk di luar yang dibatasi CHECK — constraint yang hilang harus terdengar', () => {
    expect(() => toProducts([{ ...row, status: 'ditarik' }], [], [])).toThrow(/status produk/);
  });
});

describe('toCatalogVersion', () => {
  it('mengembalikan waktu sebagai ISO-8601 UTC', () => {
    const mapped = toCatalogVersion({
      id: 'V1',
      label: 'v2.4',
      sourceDocument: 'Katalog produk Pralon 2026',
      status: 'active',
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      importedBy: 'U1',
    });

    expect(mapped.effectiveFrom).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('toCompatibleFitting', () => {
  it('melempar saat jenis fitting tidak dikenal', () => {
    expect(() =>
      toCompatibleFitting({ compatibleProductId: 'P2', name: 'Kopling', kind: 'kopling' }),
    ).toThrow(/jenis fitting/);
  });
});
