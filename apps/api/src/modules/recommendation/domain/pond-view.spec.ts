/**
 * Tampilan kolam: bahasa Indonesia tetap seperti semula; bahasa Inggris punya jumlah baris dan
 * angka yang sama.
 */
import { describe, expect, it } from 'vitest';
import { computePond } from '@snouty/engineering';
import {
  pondAssumptionsFrom,
  pondBomItemsFrom,
  pondHighlights,
  pondProse,
  pondSystemLinesFrom,
} from './pond-view.js';

describe('tampilan kolam', () => {
  const result = computePond({ lengthM: 10, widthM: 5, depthM: 1, ponds: 2, routeLengthM: 30 });
  const traces = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));

  it('highlights', () => {
    const idRows = pondHighlights(result, 4);
    expect(pondHighlights(result, 4, 'id')).toEqual(idRows);
    expect(idRows.map((x) => x.label)).toEqual([
      'Volume air',
      'Debit pengisian',
      'Pipa masuk',
      'Pipa kuras',
      'Produk Pralon',
    ]);
    const en = pondHighlights(result, 4, 'en');
    expect(en).toHaveLength(idRows.length);
    expect(en.map((x) => x.label)).toEqual([
      'Water volume',
      'Filling flow',
      'Inlet pipe',
      'Drain pipe',
      'Pralon products',
    ]);
    expect(en[0]!.value).toBe(`${String(result.volumeM3)} m³`);
    expect(en[2]!.value).toBe(idRows[2]!.value);
  });

  it('baris sistem, BOM, asumsi', () => {
    const idL = pondSystemLinesFrom(result, traces);
    const enL = pondSystemLinesFrom(result, traces, 'en');
    expect(idL[0]!.name).toBe(`Pipa masuk ${result.inletFamily}`);
    expect(enL).toHaveLength(idL.length);
    expect(enL[0]!.name).toBe(`${result.inletFamily} inlet pipe`);
    expect(enL[1]!.path).toBe('Pond bottom → discharge channel');
    expect(enL.map((l) => l.traceIds)).toEqual(idL.map((l) => l.traceIds));

    const idB = pondBomItemsFrom(result, traces);
    const enB = pondBomItemsFrom(result, traces, 'en');
    expect(enB).toHaveLength(idB.length);
    expect(enB.map((b) => b.quantity)).toEqual(idB.map((b) => b.quantity));
    expect(idB.some((b) => b.item === 'Lem PVC')).toBe(true);
    expect(enB.some((b) => b.item === 'PVC solvent cement')).toBe(true);
    expect(enB.some((b) => b.item === 'Valve / stop cock')).toBe(true);

    const idA = pondAssumptionsFrom(result, traces);
    const enA = pondAssumptionsFrom(result, traces, 'en');
    expect(enA).toHaveLength(idA.length);
    expect(idA[0]!.text).toMatch(/^Cara hitungnya: panjang × lebar × kedalaman/);
    expect(enA[0]!.text).toMatch(/^How it is worked out: /);
    expect(idA[0]!.text).not.toMatch(/ENG-\d/);
  });

  it('prosa', () => {
    const idP = pondProse(result, 'id');
    expect(idP).toEqual(pondProse(result));
    expect(idP.headline).toContain('2 kolam');
    const en = pondProse(result, 'en');
    expect(en.headline).toContain('2 ponds');
    expect(en.body).toContain(`${String(result.volumeM3)} m³`);
    expect(en.body).toContain('m³/h');
    expect(en.body).toContain('initial estimate');
  });
});

describe('tampilan kolam: penjelasan trace dua bahasa (P15-04b)', () => {
  it("trace dihitung dengan 'en' → alasan dan dasar BOM berbahasa Inggris", () => {
    const input = { lengthM: 10, widthM: 5, depthM: 1, ponds: 2, routeLengthM: 30 };
    const idResult = computePond(input);
    const enResult = computePond(input, 'en');
    const idTraces = idResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const enTraces = enResult.traces.map((t, i) => ({ ...t, id: `T${i}` }));
    const id = pondSystemLinesFrom(idResult, idTraces, 'id');
    const en = pondSystemLinesFrom(enResult, enTraces, 'en');
    en.forEach((line, i) => expect(line.reason).not.toBe(id[i]!.reason));
    expect(en[0]!.reason).toContain('Filling flow');
    expect(pondBomItemsFrom(enResult, enTraces, 'en')[0]!.basis).toContain('Inlet pipe');
  });
});
