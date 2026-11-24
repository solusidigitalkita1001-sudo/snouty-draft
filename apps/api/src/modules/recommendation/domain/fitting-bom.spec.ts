/** P18-01: baris BOQ fitting dari ENG-708/ENG-605 — jumlah dari engine, dasar perhitungan terbaca. */
import { computeHouseDrainage, computeSolution } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import {
  drainFittingNeeds,
  fittingBomRows,
  fittingKey,
  inspectionChamberRows,
  pendingNeeds,
  solventCement,
  stopValveRow,
  supplyFittingNeeds,
} from './fitting-bom.js';
import type { IdentifiedTrace } from './solution-view.js';

const solution = computeSolution({
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'both',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 8,
  planWidthM: 15,
});
const traces = solution.traces.map((t, i) => ({ ...t, id: `T${i}` })) as IdentifiedTrace[];

describe('supplyFittingNeeds + fittingBomRows', () => {
  const needs = supplyFittingNeeds(solution);

  it('air bersih: elbow utama, pengisi toren, per cabang per ukuran, elbow dan drat kran per titik', () => {
    expect(needs.map((n) => [n.kind, n.size, n.quantity])).toEqual([
      // Pipa utama 1¼" sejak tebal AW resmi (PROD/STD-04, review putaran 4 poin 4).
      ['elbow', '1¼"', 2],
      // Ujung pipa utama (review 0015): elbow + reducer ke cabang dapur 1/2" (toren atap: ujung di lantai 1).
      ['elbow', '1¼"', 1],
      ['reducer', '1¼"', 1],
      ['elbow', '3/4"', 2],
      // Beban alat UPC: kedua cabang kamar mandi 1", jadi elbow cabangnya satu baris.
      ['elbow', '1"', 2],
      ['elbow', '1/2"', 2],
      ['elbow', '1/2"', 11],
      ['faucet_elbow', '1/2"', 11],
      // Dop ujung mati tiap cabang (ENG-715, keputusan pemilik 2026-11-24): pipa utama masuk ke
      // cabang terakhir lewat elbow, jadi ujungnya tidak perlu dop.
      ['cap', '1"', 2],
      ['cap', '1/2"', 2],
    ]);
  });

  it('dop dan stop kran punya angka, bukan lagi "dihitung saat pemasangan"', () => {
    const caps = needs.filter((n) => n.kind === 'cap');
    expect(caps.map((n) => n.quantity).reduce((a, b) => a + b, 0)).toBe(4);
    expect(caps[0]).toMatchObject({
      ruleId: 'ENG-715',
      purpose: { id: 'Dop ujung jalur', en: 'Cap at the end of a run' },
    });

    const valves = stopValveRow(solution, traces, 'id');
    expect(valves).toMatchObject({ item: 'Stop kran', quantity: 2, unit: 'pcs', size: '1¼"' });
    expect(valves.basis).toContain('satu per lantai di atas lantai satu');
    expect(valves.traceIds.length).toBeGreaterThan(0);
    // Tanpa SKU: Pralon tidak menjual stop kran, jadi barisnya berjumlah tanpa produk.
    expect(valves).not.toHaveProperty('productId');
    // BOQ menampilkan peruntukan, bukan nama barang, untuk baris tanpa produk — jadi namanya
    // harus ada di peruntukannya, kalau tidak pembaca tidak tahu apa yang dibeli.
    expect(valves.purpose).toContain('Stop kran');
  });

  it('baris tanpa angka yang tersisa untuk air bersih hanya lem', () => {
    const items = pendingNeeds(
      [{ system: 'clean_water', size: solution.mainSize }],
      ['clean_water'],
      ['clean_water'],
    ).map((n) => n.item.id);
    expect(items).toEqual(['Lem PVC quick dry']);
  });

  it('baris BOQ: fitting, pcs, sistem air bersih, dasar perhitungan dari engine, status asumsi', () => {
    const rows = fittingBomRows(needs, traces, 'id', (n) =>
      fittingKey(n) === 'elbow|1¼"|' ? 'EL1' : undefined,
    );
    expect(rows[0]).toMatchObject({
      item: 'Elbow',
      purpose: 'Elbow pipa utama',
      system: 'clean_water',
      productId: 'EL1',
      quantity: 2,
      unit: 'pcs',
      provenance: 'ASSUMED',
      calc: { method: 'Elbow di pipa utama', working: '2 per pipa utama', result: '2 pcs' },
    });
    // Ukuran tanpa produk katalog: tetap berjumlah, tanpa nama produk.
    expect(rows[7]).not.toHaveProperty('productId');
    expect(rows[7]).toMatchObject({ item: 'Faucet elbow', purpose: 'Drat kran', quantity: 11 });
    expect(rows[2]).toMatchObject({
      item: 'Reducer cabang',
      size: '1¼" × 1/2"',
      purpose: 'Reducer ujung pipa utama',
    });
    expect(rows.every((r) => r.traceIds.length > 0)).toBe(true);
  });
});

// Bak kontrol (ENG-607, keputusan pemilik 2026-11-24, OQ-101): berjumlah, tanpa SKU — pekerjaan
// pasangan di lapangan.
describe('inspectionChamberRows', () => {
  const withYard = computeHouseDrainage({
    bathrooms: 2,
    basins: 1,
    kitchens: 1,
    layout: { planLengthM: 12, floors: 2, floorHeightM: 3.5, yardM: 6 },
  });
  const drainTraces = withYard.traces.map((t, i) => ({ ...t, id: `D${i}` })) as IdentifiedTrace[];

  it('satu baris per jalur, berjumlah, tanpa produk katalog', () => {
    const rows = inspectionChamberRows(withYard, drainTraces, 'id');
    expect(rows.map((r) => [r.system, r.item, r.quantity, r.unit])).toEqual([
      ['soil', 'Bak kontrol', 3, 'pcs'],
      ['waste', 'Bak kontrol', 3, 'pcs'],
    ]);
    expect(rows[0]).not.toHaveProperty('productId');
    // Alasan sama seperti stop kran: tanpa produk, yang tampil di BOQ hanya peruntukannya.
    expect(rows.map((r) => r.purpose)).toEqual([
      'Bak kontrol jalur air kotor',
      'Bak kontrol jalur air bekas',
    ]);
    expect(rows[0]!.basis).toContain('setiap 10 m jalur mendatar');
    expect(rows[0]!.traceIds.length).toBeGreaterThan(0);
  });

  it('tanpa ukuran bangunan tidak ada barisnya sama sekali', () => {
    const noLayout = computeHouseDrainage({ bathrooms: 2, basins: 1, kitchens: 1 });
    expect(inspectionChamberRows(noLayout, [], 'id')).toEqual([]);
  });
});

describe('drainFittingNeeds', () => {
  it('per jalur di ukuran jalurnya: Y per alat (4g), elbow 45°, clean out, sambungan dan topi ventilasi (4f)', () => {
    const drainage = computeHouseDrainage({
      bathrooms: 3,
      basins: 4,
      kitchens: 1,
      floors: [
        { bathrooms: 2, basins: 2, kitchens: 0 },
        { bathrooms: 1, basins: 2, kitchens: 1 },
      ],
    });
    expect(drainFittingNeeds(drainage).map((n) => [n.system, n.kind, n.size, n.quantity])).toEqual([
      ['soil', 'branch_y', drainage.soil!.size, 3],
      ['soil', 'elbow_45', drainage.soil!.size, 2],
      ['soil', 'clean_out', drainage.soil!.size, 1],
      ['soil', 'branch_y', drainage.soil!.size, 1],
      ['soil', 'vent_cap', drainage.soil!.ventSize, 1],
      ['waste', 'branch_y', drainage.waste!.size, 8],
      ['waste', 'elbow_45', drainage.waste!.size, 2],
      ['waste', 'clean_out', drainage.waste!.size, 1],
      ['waste', 'branch_y', drainage.waste!.size, 1],
      ['waste', 'vent_cap', drainage.waste!.ventSize, 1],
    ]);
  });
});

/**
 * Masukan sales Pralon 2026-11-03: "Solvent cement Pralon itu ada 2 pilihan … yang cepat kering
 * itu untuk diameter 1/2" - 3", dan yang lambat kering buat diameter 4" - 12"".
 */
describe('solvent cement menurut ukuran jalur (P33-03)', () => {
  it('sampai 3" quick dry, di atasnya slow dry', () => {
    expect(solventCement('½"').id).toBe('Lem PVC quick dry');
    expect(solventCement('3"').id).toBe('Lem PVC quick dry');
    expect(solventCement('4"').id).toBe('Lem PVC slow dry');
    expect(solventCement('12"').en).toBe('PVC solvent cement (slow dry)');
  });

  it('ukuran yang bukan inci atau tidak terbaca tetap tanpa jenis', () => {
    expect(solventCement('110 mm').id).toBe('Lem PVC');
    expect(solventCement('—').id).toBe('Lem PVC');
  });

  it('baris materialnya ikut: air kotor 4" slow dry, air bekas 2½" quick dry', () => {
    const items = pendingNeeds([
      { system: 'soil', size: '4"' },
      { system: 'waste', size: '2½"' },
    ]).filter((n) => n.unit === 'kaleng');
    expect(items.map((n) => n.item.id)).toEqual(['Lem PVC slow dry', 'Lem PVC quick dry']);
  });
});
