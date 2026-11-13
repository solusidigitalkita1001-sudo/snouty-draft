/**
 * Temuan 6 smoke test 13 Nov 2026: `calc.result = "8 batang"` tercetak di Bagian 4 sementara
 * `quantity = 1` tercetak di Bagian 5 untuk baris yang sama.
 */
import type { BomItem } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import {
  assertBomQuantitiesMatchCalc,
  bomQuantityMismatches,
  quantityInResult,
  ReportQuantityMismatchError,
} from './boq-consistency.js';

const row = (over: Partial<BomItem> = {}): BomItem =>
  ({
    item: 'Pipa PVC AW',
    size: '1"',
    quantity: 7,
    unit: 'batang',
    basis: '',
    provenance: 'ESTIMATED',
    traceIds: [],
    calc: { method: 'Jalur utama', working: '25,5 m ÷ 4 m = 6,38', result: '7 batang' },
    ...over,
  }) as BomItem;

describe('quantityInResult', () => {
  it('membaca angka hasil hitung dalam dua bahasa dan dua satuan', () => {
    expect(quantityInResult('7 batang')).toBe(7);
    expect(quantityInResult('7 rods')).toBe(7);
    expect(quantityInResult('12 pcs')).toBe(12);
    expect(quantityInResult('1.234 pcs')).toBe(1234);
    expect(quantityInResult('3,1 m')).toBe(3.1);
    expect(quantityInResult('menyusul')).toBeNull();
  });
});

describe('bomQuantityMismatches', () => {
  it('baris yang hitungannya sama dengan jumlahnya tidak dilaporkan', () => {
    expect(
      bomQuantityMismatches([
        row(),
        row({ quantity: 12, unit: 'pcs', calc: { method: '', working: '', result: '12 pcs' } }),
      ]),
    ).toEqual([]);
  });

  it('"8 batang" untuk 1 batang adalah dua jawaban untuk satu baris', () => {
    const mismatches = bomQuantityMismatches([
      row({
        quantity: 1,
        calc: { method: 'Jalur utama', working: '25,5 m ÷ 4 m', result: '8 batang' },
      }),
    ]);
    expect(mismatches).toEqual([
      { item: 'Pipa PVC AW', size: '1"', quantity: 1, result: '8 batang' },
    ]);
    expect(() => assertBomQuantitiesMatchCalc([row({ quantity: 1 })])).toThrow(
      ReportQuantityMismatchError,
    );
  });

  it('baris yang jumlahnya memang belum dihitung tidak dianggap bertentangan', () => {
    const dop: BomItem = {
      item: 'Dop',
      size: '1"',
      quantity: 0,
      unit: 'pcs',
      basis: '',
      provenance: 'ASSUMED',
      traceIds: [],
      pending: true,
    };
    expect(bomQuantityMismatches([dop])).toEqual([]);
  });
});
