/**
 * P5-04a — Policy 2: daftar produk disaring terhadap katalog (invarian C-2), dan
 * fakta produk tidak pernah `ASSUMED`.
 */
import { describe, expect, it } from 'vitest';
import type { ProductCardDto } from '@snouty/shared-types';
import { filterToCatalog, productSpecProvenance } from './product-filter.js';

function card(productId: string, sku: string): ProductCardDto {
  return {
    productId,
    sku,
    name: `Produk ${sku}`,
    sizeLabel: '1"',
    state: 'VERIFIED_SELECTED',
    provenance: 'VERIFIED',
    sourceDocument: 'Katalog produk Pralon 2026',
    sourcePage: 14,
    imageUrl: null,
  };
}

describe('Policy 2 — penyaringan katalog', () => {
  it('membuang kartu yang produknya tidak ada di katalog', () => {
    const catalog = new Set(['01JBREAL0000000000000000AA']);
    const result = filterToCatalog(
      [
        card('01JBREAL0000000000000000AA', 'PVC-AW-1'),
        card('01JBHALU0000000000000000BB', 'MERK-X-1'),
      ],
      catalog,
    );
    expect(result.allowed.map((c) => c.sku)).toEqual(['PVC-AW-1']);
    expect(result.rejectedSkus).toEqual(['MERK-X-1']);
  });

  it('katalog kosong berarti tidak ada kartu — bukan semua kartu lolos', () => {
    const result = filterToCatalog([card('01JBANY00000000000000000AA', 'X')], new Set());
    expect(result.allowed).toEqual([]);
    expect(result.rejectedSkus).toEqual(['X']);
  });

  it('kartu yang dibuang dilaporkan, bukan hilang diam-diam', () => {
    const result = filterToCatalog([card('01JBGHOST000000000000000CC', 'HANTU')], new Set());
    expect(result.rejectedSkus).toHaveLength(1);
  });

  it('tidak mengubah urutan kartu yang lolos', () => {
    const catalog = new Set(['A'.repeat(26), 'B'.repeat(26)]);
    const result = filterToCatalog([card('B'.repeat(26), 'b'), card('A'.repeat(26), 'a')], catalog);
    expect(result.allowed.map((c) => c.sku)).toEqual(['b', 'a']);
  });
});

describe('Policy 2 — spesifikasi produk tidak pernah ditebak', () => {
  it('kolom terisi: VERIFIED', () => {
    expect(productSpecProvenance('10 bar')).toBe('VERIFIED');
  });

  it('kolom kosong atau spasi: UNAVAILABLE, tidak pernah ASSUMED', () => {
    expect(productSpecProvenance(null)).toBe('UNAVAILABLE');
    expect(productSpecProvenance('')).toBe('UNAVAILABLE');
    expect(productSpecProvenance('   ')).toBe('UNAVAILABLE');
  });
});
