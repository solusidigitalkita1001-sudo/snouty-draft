/**
 * Jumlah beli pipa (audit C6): panjang bersih dari jalur, panjang batang dari produk katalog yang
 * terpilih, dan alasan selisihnya tertulis. Tanpa panjang batang → meter, bukan 4 m karangan.
 */
import { computeBuildingWater } from '@snouty/engineering';
import type { Product, SpecValue } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { buildingBomItems } from './building-water-view.js';
import { pipePurchase, stockLengthOf } from './pipe-quantity.js';
import type { IdentifiedTrace } from './solution-view.js';

const unavailable = { provenance: 'UNAVAILABLE' } as unknown as SpecValue;
const product = (name: string, rodLength: SpecValue = unavailable): Product =>
  ({ id: 'P1', sku: 'S1', name, rodLength }) as unknown as Product;

describe('stockLengthOf', () => {
  it('dari spesifikasi terverifikasi lebih dulu, lalu dari nama produk katalog', () => {
    const verified = { provenance: 'VERIFIED', value: '6 m' } as unknown as SpecValue;
    expect(stockLengthOf(product('Pipa AW 4" x 4 Meter', verified))?.meters).toBe(6);
    expect(stockLengthOf(product('Pipa (Bell End ) Abu AW 3 " x 5.8 Meter'))?.meters).toBe(5.8);
    expect(stockLengthOf(product('Pipa HDPE PE 100 PN-10 110 mm'))).toBeNull();
  });
});

describe('pipePurchase', () => {
  it('90 m ÷ batang 5,8 m = 15,52 → 16 batang, dengan dasar yang bisa dilacak', () => {
    const p = pipePurchase(
      90,
      '1 riser × 90 m',
      { meters: 5.8, productName: 'Pipa AW 6" x 5.8 Meter' },
      'id',
    );
    expect(p).toMatchObject({ quantity: 16, unit: 'batang' });
    expect(p.basis).toBe(
      'Panjang bersih 90 m (1 riser × 90 m) ÷ 5,8 m per batang (Pipa AW 6" x 5.8 Meter) = 15,52 → 16 batang, dibulatkan ke batang utuh; belum termasuk sisa potongan.',
    );
  });

  it('gulungan HDPE dan produk tanpa panjang batang dihitung dalam meter', () => {
    expect(
      pipePurchase(90.2, 'x', { meters: 100, productName: 'Pipa HDPE 63 mm x 100 Meter' }, 'id'),
    ).toMatchObject({ quantity: 91, unit: 'meter' });
    const none = pipePurchase(90, 'x', null, 'en');
    expect(none).toMatchObject({ quantity: 90, unit: 'meter' });
    expect(none.basis).toContain('not in the catalogue');
  });
});

describe('BOM gedung', () => {
  const input = { floors: 20, floorAreaM2: 5000, floorHeightM: 4.5, bathroomsPerFloor: 10 };
  const result = computeBuildingWater(input);
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` })) as IdentifiedTrace[];

  it('riser: jumlah riser × tinggi gedung ÷ batang katalog; tidak ada pipa per lantai dari luas', () => {
    const bom = buildingBomItems(result, input, traces, 'id', (role) =>
      role === 'riser' ? { meters: 4, productName: 'Pipa AW 6" x 4 Meter' } : null,
    );
    expect(bom.map((b) => b.item)).toEqual(['Pipa transfer HDPE', 'Pipa riser PVC AW']);
    expect(bom[1]).toMatchObject({ quantity: 90, unit: 'batang' }); // 4 × 90 m ÷ 4 m
    expect(bom[1]!.basis).toContain('4 riser × 90 m, melayani 20 lantai');
    expect(bom[0]).toMatchObject({ quantity: 90, unit: 'meter' });
    expect(bom[0]!.basis).toContain('jalur datar belum disebut');
  });
});
