/** P18-01: baris BOQ fitting dari ENG-708/ENG-605 — jumlah dari engine, dasar perhitungan terbaca. */
import { computeHouseDrainage, computeSolution } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import {
  drainFittingNeeds,
  fittingBomRows,
  fittingKey,
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
      ['elbow', '1"', 2],
      // Ujung pipa utama (review 0015): elbow + reducer ke cabang dapur 1/2" (toren atap: ujung di lantai 1).
      ['elbow', '1"', 1],
      ['reducer', '1"', 1],
      ['elbow', '3/4"', 2],
      ['elbow', '1"', 1],
      ['elbow', '3/4"', 1],
      ['elbow', '1/2"', 2],
      ['elbow', '1/2"', 11],
      ['faucet_elbow', '1/2"', 11],
    ]);
  });

  it('baris BOQ: fitting, pcs, sistem air bersih, dasar perhitungan dari engine, status asumsi', () => {
    const rows = fittingBomRows(needs, traces, 'id', (n) =>
      fittingKey(n) === 'elbow|1"|' ? 'EL1' : undefined,
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
    expect(rows[8]).not.toHaveProperty('productId');
    expect(rows[8]).toMatchObject({ item: 'Faucet elbow', purpose: 'Drat kran', quantity: 11 });
    expect(rows[2]).toMatchObject({
      item: 'Reducer cabang',
      size: '1" × 1/2"',
      purpose: 'Reducer ujung pipa utama',
    });
    expect(rows.every((r) => r.traceIds.length > 0)).toBe(true);
  });
});

describe('drainFittingNeeds', () => {
  it('per jalur di ukuran jalurnya: Y (alat + lantai atas), elbow 45°, clean out', () => {
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
      ['soil', 'branch_y', drainage.soil!.size, 4],
      ['soil', 'elbow_45', drainage.soil!.size, 2],
      ['soil', 'clean_out', drainage.soil!.size, 1],
      ['waste', 'branch_y', drainage.waste!.size, 9],
      ['waste', 'elbow_45', drainage.waste!.size, 2],
      ['waste', 'clean_out', drainage.waste!.size, 1],
    ]);
  });
});
