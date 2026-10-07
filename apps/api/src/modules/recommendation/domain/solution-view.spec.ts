/**
 * P15-04a — jalur bangunan dua bahasa: 'id' tak berubah; 'en' menerjemahkan nama, jalur, BOM, dan
 * asumsi dengan jumlah dan ukuran yang sama. Penjelasan trace ikut bahasa bila engine dipanggil
 * dengan locale percakapan (P15-04b).
 */
import { describe, expect, it } from 'vitest';
import { computeSolution, type SolutionInput } from '@snouty/engineering';
import {
  assumptionsFrom,
  bomItemName,
  bomItemsFrom,
  systemLinesFrom,
  type IdentifiedTrace,
} from './solution-view.js';

const INPUT: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
};
const solution = computeSolution(INPUT);
const traces: readonly IdentifiedTrace[] = solution.traces.map((t, i) => ({ ...t, id: `S${i}` }));

describe('solution-view locale', () => {
  it("'id' eksplisit sama dengan bawaan", () => {
    expect(systemLinesFrom(solution, traces, 'id')).toEqual(systemLinesFrom(solution, traces));
    expect(bomItemsFrom(solution, traces, 'id')).toEqual(bomItemsFrom(solution, traces));
    expect(assumptionsFrom(solution, traces, [], 'id')).toEqual(
      assumptionsFrom(solution, traces, []),
    );
    expect(systemLinesFrom(solution, traces)[0]!.name).toBe('Pipa distribusi utama');
    expect(bomItemsFrom(solution, traces)[0]!.item).toBe('Pipa PVC AW');
  });

  it("'en': tiga baris sistem, ukuran dan trace sama, nama Inggris", () => {
    const id = systemLinesFrom(solution, traces, 'id');
    const en = systemLinesFrom(solution, traces, 'en');
    expect(en.map((l) => l.name)).toEqual([
      'Main distribution pipe',
      'Branch per floor',
      'Fixture connection',
    ]);
    expect(en.map((l) => l.path)).toEqual([
      'Source → riser',
      'Riser → water outlets',
      'Branch → fixture',
    ]);
    expect(en.map((l) => l.size)).toEqual(id.map((l) => l.size));
    expect(en.map((l) => l.traceIds)).toEqual(id.map((l) => l.traceIds));
  });

  it("'en' (P15-04b): trace yang dihitung dalam bahasa Inggris memberi alasan berbahasa Inggris", () => {
    const enSolution = computeSolution(INPUT, 'en');
    const enTraces: readonly IdentifiedTrace[] = enSolution.traces.map((t, i) => ({
      ...t,
      id: `S${i}`,
    }));
    const id = systemLinesFrom(solution, traces, 'id');
    const en = systemLinesFrom(enSolution, enTraces, 'en');
    expect(en.map((l) => l.size)).toEqual(id.map((l) => l.size));
    en.forEach((line, i) => expect(line.reason).not.toBe(id[i]!.reason));
    expect(en[0]!.reason).toContain('8-unit threshold');
    expect(bomItemsFrom(enSolution, enTraces, 'en')[0]!.basis).toContain('planning estimate');
  });

  it("'en': BOM — jumlah dan ukuran sama, nama dan satuan Inggris", () => {
    const id = bomItemsFrom(solution, traces, 'id');
    const en = bomItemsFrom(solution, traces, 'en');
    expect(en.map((i) => [i.quantity, i.size])).toEqual(id.map((i) => [i.quantity, i.size]));
    expect(en[0]!.item).toBe('PVC AW pipe');
    expect(en[0]!.unit).toBe('rods');
    expect(en.every((i) => !i.item.startsWith('Pipa'))).toBe(true);
  });

  it("'en': asumsi dimensi berbahasa Inggris; jumlah sama", () => {
    const id = assumptionsFrom(solution, traces, [], 'id');
    const en = assumptionsFrom(solution, traces, [], 'en');
    expect(en).toHaveLength(id.length);
    const dimensions = en.find((a) => a.fieldPath === 'building.dimensions');
    expect(dimensions?.text).toBe(
      'Pipe length is estimated because the building dimensions have not been provided.',
    );
  });

  it('bomItemName: item tak dikenal lewat apa adanya; keluarga pipa tetap', () => {
    expect(bomItemName('Tee', 'en')).toBe('Tee');
    expect(bomItemName('Pipa PVC D', 'en')).toBe('PVC D pipe');
    expect(bomItemName('Pipa HDPE', 'en')).toBe('HDPE pipe');
    expect(bomItemName('Barang baru', 'en')).toBe('Barang baru');
  });
});
