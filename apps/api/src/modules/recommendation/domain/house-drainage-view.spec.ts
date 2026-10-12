/**
 * Rumah 2 lantai, 3 kamar mandi, "Keduanya" (laporan pemilik 2026-10-12): pembuangan ikut dihitung
 * dan tampil di solusi yang sama; "Pembuangan" saja tidak menampilkan jalur air bersih.
 */
import { computeHouseDrainage } from '@snouty/engineering';
import type { Recommendation } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import { drainageSystemLines, withHouseDrainage } from './house-drainage-view.js';
import type { IdentifiedTrace } from './solution-view.js';

const result = computeHouseDrainage({ bathrooms: 3, basins: 0, kitchens: 1 });
const traces = result.traces.map((t, i) => ({ ...t, id: `D${i}` })) as IdentifiedTrace[];

const base = {
  id: 'R',
  headline: 'Rumah 2 lantai',
  body: 'Air bersih memakai PVC AW 1".',
  stats: {
    outletCount: 4,
    mainSize: '1"',
    branchCount: 2,
    fixtureConnectionSize: '1/2"',
    productCount: 1,
  },
  systemLines: [
    {
      name: 'Pipa utama',
      path: 'Toren → rumah',
      size: '1"',
      reason: '',
      provenance: 'ASSUMED',
      traceIds: [],
      role: 'main',
    },
  ],
  products: [{ productId: 'AW1', size: '1"', role: 'main', matchState: 'MATCHED', reason: '' }],
  bom: [
    {
      item: 'Pipa PVC AW',
      size: '1"',
      quantity: 5,
      unit: 'batang',
      basis: '',
      provenance: 'ASSUMED',
      traceIds: [],
    },
  ],
  assumptions: [],
  overallProvenance: 'ASSUMED',
} as unknown as Recommendation;
const drainProducts = [
  { productId: 'D4', size: '4"', role: 'main', matchState: 'MATCHED', reason: '' },
] as unknown as Recommendation['products'];

describe('pembuangan rumah di solusi', () => {
  it('baris sistem: air kotor 4" ke septic tank, air bekas 2", ventilasi, sambungan tiap alat', () => {
    const lines = drainageSystemLines(result, traces, 'id');
    expect(lines.map((l) => [l.name, l.size])).toEqual([
      ['Pipa air kotor PVC D', '4"'],
      ['Pipa ventilasi air kotor', '2"'],
      ['Pipa air bekas PVC D', '2"'],
      ['Pipa ventilasi air bekas', '1¼"'],
      ['Sambungan buangan tiap alat', '1½"–4"'],
    ]);
    expect(lines[0]!.traceIds).toEqual(['D0', 'D1']);
    expect(lines[2]!.traceIds).toEqual(['D0', 'D2']);
    expect(lines[0]!.reason).toContain('Beban air kotor 12');
  });

  it('"Keduanya": air bersih tetap, pembuangan ditambahkan', () => {
    const merged = withHouseDrainage(base, result, traces, drainProducts, false, 'id');
    expect(merged.systemLines).toHaveLength(1 + 5);
    expect(merged.products.map((p) => p.productId)).toEqual(['AW1', 'D4']);
    expect(merged.bom).toEqual(base.bom);
    expect(merged.body).toContain('Untuk pembuangan, kloset dibuang ke septic tank lewat PVC D 4"');
    expect(merged.body).toContain('sedangkan floor drain/shower dan bak cuci dapur lewat 2"');
  });

  it('"Pembuangan" saja: tanpa jalur, produk, dan material air bersih', () => {
    const only = withHouseDrainage(base, result, traces, drainProducts, true, 'id');
    expect(only.systemLines.some((l) => l.name === 'Pipa utama')).toBe(false);
    expect(only.products.map((p) => p.productId)).toEqual(['D4']);
    expect(only.bom).toEqual([]);
    expect(only.headline).toBe('Pembuangan rumah: air kotor 4", air bekas 2"');
  });
});
