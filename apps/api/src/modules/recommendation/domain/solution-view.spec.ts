/**
 * Jalur rumah di layar solusi. Koreksi 2026-10-12 ("koreksi itungannya udh bener belom"): pipa
 * utama dari debit dan jalur, sumber air ditampilkan dengan tekanannya, material hanya dari
 * panjang yang diketahui. Dua bahasa: 'en' menerjemahkan nama dan asumsi dengan angka yang sama.
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
const identify = (s: ReturnType<typeof computeSolution>): readonly IdentifiedTrace[] =>
  s.traces.map((t, i) => ({ ...t, id: `S${i}` }));
const solution = computeSolution(INPUT);
const traces = identify(solution);
const sized = computeSolution({ ...INPUT, planLengthM: 8, planWidthM: 15 });
const sizedTraces = identify(sized);

describe('baris sistem rumah', () => {
  it('pipa utama, cabang, sambungan, dan tekanan dari toren atap', () => {
    const lines = systemLinesFrom(solution, traces, 'id');
    expect(lines.map((l) => l.name)).toEqual([
      'Pipa distribusi utama',
      'Cabang',
      'Sambungan fixture',
      'Tekanan dari toren atap',
    ]);
    expect(lines[0]!.size).toBe(solution.mainSize);
    expect(lines[0]!.reason).toContain('kurva Hunter');
    expect(lines[1]!.size).toBe(solution.branchSize);
    expect(lines[3]!.reason).toContain('pompa pendorong');
  });

  it('PDAM: tekanan yang dibutuhkan di meteran; toren bawah: titik kerja pompa', () => {
    const pdam = computeSolution({ ...INPUT, waterSource: 'municipal' });
    const pdamLine = systemLinesFrom(pdam, identify(pdam), 'id').at(-1)!;
    expect(pdamLine.name).toBe('Tekanan yang dibutuhkan di meteran PDAM');
    expect(pdamLine.size).toMatch(/^\d+(,\d+)? bar$/);
    const ground = computeSolution({ ...INPUT, waterSource: 'ground_tank' });
    expect(systemLinesFrom(ground, identify(ground), 'id').at(-1)!.name).toBe(
      'Pompa (titik kerja)',
    );
  });

  it("'en': nama Inggris, ukuran dan trace sama", () => {
    const id = systemLinesFrom(solution, traces, 'id');
    const en = systemLinesFrom(solution, traces, 'en');
    expect(en[0]!.name).toBe('Main distribution pipe');
    // Ukuran pipa sama; angka tekanan hanya beda format desimal (0,05 / 0.05).
    expect(en.slice(0, 3).map((l) => l.size)).toEqual(id.slice(0, 3).map((l) => l.size));
    expect(en.map((l) => l.traceIds)).toEqual(id.map((l) => l.traceIds));
  });
});

describe('material rumah', () => {
  it('tanpa ukuran rumah: tidak ada jumlah pipa karangan', () => {
    expect(bomItemsFrom(solution, traces, 'id')).toEqual([]);
  });

  it('8 × 15 m: panjang bersih ÷ panjang batang katalog', () => {
    const bom = bomItemsFrom(sized, sizedTraces, 'id', {
      meters: 4,
      productName: 'Pipa (TS End) Putih AW 1" x 4 Meter',
    });
    expect(bom[0]).toMatchObject({ item: 'Pipa PVC AW', size: sized.mainSize, unit: 'batang' });
    expect(bom[0]!.quantity).toBe(Math.ceil(25.5 / 4));
    expect(bom[0]!.basis).toContain('Panjang bersih 25,5 m');
    const en = bomItemsFrom(sized, sizedTraces, 'en', { meters: 4, productName: 'x' });
    expect(en[0]!.item).toBe('PVC AW pipe');
    expect(en[0]!.unit).toBe('rods');
  });

  it('ukuran rumah diketahui: cabang, sambungan, dan tee ikut dihitung (P16-60)', () => {
    const stock = (name: string) => ({ meters: 4, productName: name });
    const bom = bomItemsFrom(sized, sizedTraces, 'id', stock('utama'), {
      branch: stock('cabang'),
      fixture: stock('sambungan'),
      tee: { productId: 'TEE-1' },
    });
    const layout = sized.branchLayout!;
    // Sisi terpanjang 15 m × jumlah cabang; 1,5 m per titik air; 1 tee per cabang.
    expect(layout.branchNetM).toBe(sized.branchCount * 15);
    expect(layout.fixtureNetM).toBe(sized.outletCount * 1.5);
    expect(bom.map((b) => [b.size, b.quantity, b.unit])).toEqual([
      [sized.mainSize, Math.ceil(25.5 / 4), 'batang'],
      [sized.branchSize, Math.ceil(layout.branchNetM / 4), 'batang'],
      [sized.fixtureConnectionSize, Math.ceil(layout.fixtureNetM / 4), 'batang'],
      [sized.mainSize, sized.branchCount, 'pcs'],
    ]);
    expect(bom[3]).toMatchObject({ item: 'Tee cabang', productId: 'TEE-1', provenance: 'ASSUMED' });
  });

  it('bomItemName: item tak dikenal lewat apa adanya; keluarga pipa tetap', () => {
    expect(bomItemName('Tee', 'en')).toBe('Tee');
    expect(bomItemName('Pipa PVC D', 'en')).toBe('PVC D pipe');
    expect(bomItemName('Pipa HDPE', 'en')).toBe('HDPE pipe');
    expect(bomItemName('Barang baru', 'en')).toBe('Barang baru');
  });
});

describe('asumsi rumah', () => {
  it('cara hitung, ukuran rumah yang belum ada, dan asumsi registry yang bisa diubah', () => {
    const list = assumptionsFrom(solution, traces, [], 'id');
    expect(list[0]!.text).toMatch(/^Cara hitungnya:/);
    expect(list.find((a) => a.fieldPath === 'building.dimensions')?.text).toContain(
      'panjang × lebar',
    );
    expect(list.map((a) => a.assumptionId)).toEqual(
      expect.arrayContaining(['WSFU_WATER_CLOSET_2_2', 'TANK_STAND_1M', 'HOUSE_RUN_20M']),
    );
    expect(list.some((a) => /tim teknis Pralon menghitungnya/.test(a.text))).toBe(false);
  });

  it('ukuran rumah diketahui: tidak ada lagi asumsi panjang jalur 20 m', () => {
    const list = assumptionsFrom(sized, sizedTraces, [], 'id');
    expect(list.some((a) => a.fieldPath === 'building.dimensions')).toBe(false);
    expect(list.some((a) => a.assumptionId === 'HOUSE_RUN_20M')).toBe(false);
  });

  it("'en': jumlah sama, teks Inggris", () => {
    const id = assumptionsFrom(solution, traces, [], 'id');
    const en = assumptionsFrom(solution, traces, [], 'en');
    expect(en).toHaveLength(id.length);
    expect(en[0]!.text).toMatch(/^How it is worked out:/);
  });
});
