/**
 * P17-01 (DD-01 #4, #8): BOQ dan tab Produk dari satu daftar. Kasus: rumah 2 lantai — air bersih
 * (pipa utama + cabang SKU sama, tee), air kotor (pipa + ventilasi, Y tanpa jumlah).
 */
import { describe, expect, it } from 'vitest';
import { boqFrom, displayName } from './boq.js';
import type { BomItem, SelectedProduct } from './recommendation.js';

const product = (
  productId: string,
  role: SelectedProduct['role'],
  extra: Partial<SelectedProduct> = {},
): SelectedProduct => ({
  productId,
  role,
  size: '1"',
  matchState: 'VERIFIED_SELECTED',
  reason: '',
  ...extra,
});

const bom = (extra: Partial<BomItem> & Pick<BomItem, 'item' | 'size' | 'quantity' | 'unit'>) =>
  ({ basis: 'dasar', provenance: 'ASSUMED', traceIds: [], ...extra }) as BomItem;

const RECOMMENDATION = {
  products: [
    product('AW1', 'main', { name: 'Pipa AW 1"', purpose: 'Pipa utama', system: 'clean_water' }),
    product('AW1', 'branch', { name: 'Pipa AW 1"', purpose: 'Cabang', system: 'clean_water' }),
    product('TEE1', 'fitting', {
      name: 'Tee 1"',
      purpose: 'Sambungan cabang',
      system: 'clean_water',
    }),
    product('D4', 'main', { name: 'Pipa D 4"', size: '4"', purpose: 'Air kotor', system: 'soil' }),
    product('Y4', 'fitting', {
      name: 'Y D 4"',
      size: '4"',
      purpose: 'Sambungan air kotor',
      system: 'soil',
    }),
    product('GONE', 'main', { matchState: 'INFORMATION_UNAVAILABLE' }),
  ],
  bom: [
    bom({
      item: 'Pipa PVC AW + Pipa PVC AW',
      purpose: 'Pipa utama · Cabang',
      system: 'clean_water',
      productId: 'AW1',
      size: '1"',
      quantity: 11,
      unit: 'batang',
      netLengthM: 40.5,
    }),
    bom({
      item: 'Tee cabang',
      system: 'clean_water',
      productId: 'TEE1',
      size: '1"',
      quantity: 4,
      unit: 'pcs',
    }),
    // Baris lama tanpa sistem: sistemnya diambil dari produknya.
    bom({ item: 'Pipa PVC D', productId: 'D4', size: '4"', quantity: 5, unit: 'batang' }),
  ],
};

describe('boqFrom', () => {
  const boq = boqFrom(RECOMMENDATION);

  it('membagi baris per sistem dengan urutan air bersih → air kotor; pipa sebelum fitting', () => {
    expect(boq.sections.map((s) => s.system)).toEqual(['clean_water', 'soil']);
    expect(boq.sections[0]!.rows.map((r) => [r.no, r.kind, r.productId])).toEqual([
      [1, 'pipe', 'AW1'],
      [2, 'fitting', 'TEE1'],
    ]);
  });

  it('fitting terpilih tanpa baris jumlah saat fitting sudah dihitung adalah sisa pencocokan (4b)', () => {
    const soil = boq.sections[1]!.rows;
    expect(soil.map((r) => [r.no, r.productId, r.quantity, r.pending])).toEqual([
      [3, 'D4', 5, undefined],
    ]);
  });

  it('produk terpilih tanpa jumlah tetap jadi baris BOQ tanpa nomor bila fitting belum dihitung', () => {
    const noFittings = boqFrom({
      ...RECOMMENDATION,
      bom: RECOMMENDATION.bom.filter((b) => b.unit !== 'pcs'),
    });
    const soil = noFittings.sections[1]!.rows;
    expect(soil[1]).toMatchObject({
      no: null,
      kind: 'fitting',
      productId: 'Y4',
      productName: 'Y D 4"',
      purpose: 'Sambungan air kotor',
      pending: true,
    });
  });

  it('nama produk dan peruntukan diisi dari produk terpilih bila baris tidak membawanya', () => {
    expect(boq.sections[1]!.rows[0]).toMatchObject({
      productName: 'Pipa D 4"',
      purpose: 'Air kotor',
    });
  });

  it('kartu produk = SKU di BOQ, dengan jumlah total dan nomor barisnya', () => {
    expect(boq.products.map((p) => [p.productId, p.quantity, p.unit, p.rowNos])).toEqual([
      ['AW1', 11, 'batang', [1]],
      ['TEE1', 4, 'pcs', [2]],
      ['D4', 5, 'batang', [3]],
    ]);
    expect(boq.products[0]!.selections).toHaveLength(2);
  });

  it('produk INFORMATION_UNAVAILABLE tidak muncul di BOQ maupun kartu', () => {
    const ids = boq.sections.flatMap((s) => s.rows.map((r) => r.productId));
    expect(ids).not.toContain('GONE');
    expect(boq.products.map((p) => p.productId)).not.toContain('GONE');
  });

  it('tanpa ukuran bangunan (BOM kosong): semua produk jadi baris tanpa jumlah', () => {
    const empty = boqFrom({ products: RECOMMENDATION.products, bom: [] });
    const rows = empty.sections.flatMap((s) => s.rows);
    expect(rows.every((r) => r.pending && r.no === null)).toBe(true);
    expect(rows.map((r) => r.productId)).toEqual(['AW1', 'TEE1', 'D4', 'Y4']);
  });

  it('rekomendasi tanpa sistem sama sekali: satu bagian tanpa nama', () => {
    const legacy = boqFrom({
      products: [product('X', 'main', { name: 'Pipa X' })],
      bom: [bom({ item: 'Pipa', productId: 'X', size: '2"', quantity: 3, unit: 'batang' })],
    });
    expect(legacy.sections).toHaveLength(1);
    expect(legacy.sections[0]!.system).toBeNull();
    expect(legacy.products[0]).toMatchObject({ productId: 'X', quantity: 3, rowNos: [1] });
  });
});

describe('boqFrom — barang yang belum dihitung (review laporan 0015)', () => {
  it('baris pending tampil tanpa angka dan tanpa nomor; tidak ikut kartu produk', () => {
    const boq = boqFrom({
      products: [],
      bom: [
        bom({
          item: 'Stop kran',
          system: 'clean_water',
          size: '—',
          quantity: 0,
          unit: 'pcs',
          pending: true,
        }),
      ],
    });
    expect(boq.sections[0]!.rows[0]).toMatchObject({
      item: 'Stop kran',
      no: null,
      quantity: null,
      pending: true,
    });
    expect(boq.products).toEqual([]);
  });
});

describe('displayName (review putaran 4, 5c)', () => {
  it('nama katalog tetap, hanya spasi sebelum tanda inci yang dibuang', () => {
    expect(displayName('Socket DV 2 "')).toBe('Socket DV 2"');
    expect(displayName('Elbow DV 45° 2 1/2"')).toBe('Elbow DV 45° 2 1/2"');
    expect(displayName('Tee  Abu Ts 1" x 1/2"')).toBe('Tee Abu Ts 1" x 1/2"');
    expect(displayName(undefined)).toBeUndefined();
  });
});
