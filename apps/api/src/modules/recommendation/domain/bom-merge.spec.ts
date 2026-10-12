import type { BomItem } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { mergeBomBySku } from './bom-merge.js';

const row = (over: Partial<BomItem>): BomItem => ({
  item: 'Pipa PVC AW',
  size: '6"',
  quantity: 1,
  unit: 'batang',
  basis: '',
  provenance: 'ASSUMED',
  traceIds: [],
  ...over,
});

describe('mergeBomBySku (temuan laporan SNTY-2026-10-0002)', () => {
  it('dua peran dengan SKU sama → satu baris, jumlah dijumlahkan, peran disebut', () => {
    const merged = mergeBomBySku([
      row({
        item: 'Pipa transfer PVC AW',
        productId: 'A',
        quantity: 11,
        basis: 'transfer.',
        traceIds: ['t1'],
      }),
      row({
        item: 'Pipa riser PVC AW',
        productId: 'A',
        quantity: 22,
        basis: 'riser.',
        traceIds: ['t2'],
      }),
      row({ item: 'Pipa PVC D', size: '4"', productId: 'B', quantity: 3 }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      item: 'Pipa transfer PVC AW + Pipa riser PVC AW',
      quantity: 33,
      basis: 'transfer. riser.',
      traceIds: ['t1', 't2'],
    });
  });

  it('baris tanpa produk dan satuan berbeda tidak digabung', () => {
    const merged = mergeBomBySku([
      row({ productId: 'A', unit: 'batang' }),
      row({ productId: 'A', unit: 'meter' }),
      row({}),
      row({}),
    ]);
    expect(merged).toHaveLength(4);
  });
});
