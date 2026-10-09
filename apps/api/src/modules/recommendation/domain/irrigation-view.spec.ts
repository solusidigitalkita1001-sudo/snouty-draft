/**
 * P15-04a — pembangun solusi irigasi dua bahasa: 'id' tetap bawaan dan tak berubah; 'en' memakai
 * angka, jumlah baris, dan keluarga pipa yang sama dengan teks bahasa Inggris.
 */
import { describe, expect, it } from 'vitest';
import { computeIrrigation } from '@snouty/engineering';
import {
  irrigationAssumptionsFrom,
  irrigationBomItemsFrom,
  irrigationProse,
  irrigationStatsFrom,
  irrigationSystemLinesFrom,
} from './irrigation-view.js';
import type { IdentifiedTrace } from './solution-view.js';

const result = computeIrrigation({
  areaHa: 1,
  method: 'sprinkler',
  mainRunMeters: 350,
  elevation: 'level',
});
const traces: readonly IdentifiedTrace[] = result.traces.map((t, i) => ({ ...t, id: `I${i}` }));
const stats = irrigationStatsFrom(result, 1, 3);

describe('irrigation-view locale', () => {
  it("'id' eksplisit sama dengan bawaan", () => {
    expect(irrigationSystemLinesFrom(result, traces, 'id')).toEqual(
      irrigationSystemLinesFrom(result, traces),
    );
    expect(irrigationBomItemsFrom(result, traces, 'id')).toEqual(
      irrigationBomItemsFrom(result, traces),
    );
    expect(irrigationAssumptionsFrom(traces, [], 'id')).toEqual(
      irrigationAssumptionsFrom(traces, []),
    );
    expect(irrigationProse(stats, result, 'id')).toEqual(irrigationProse(stats, result));
    expect(irrigationSystemLinesFrom(result, traces)[0]!.name).toBe(
      `Jalur utama ${result.mainFamily}`,
    );
    expect(irrigationProse(stats, result).headline).toMatch(/^Perkiraan awal irigasi lahan 1 ha/);
  });

  it("'en': baris sistem berbahasa Inggris, ukuran dan trace sama", () => {
    const id = irrigationSystemLinesFrom(result, traces, 'id');
    const en = irrigationSystemLinesFrom(result, traces, 'en');
    expect(en).toHaveLength(id.length);
    expect(en.map((l) => l.size.replace('class', 'kelas'))).toEqual(id.map((l) => l.size));
    expect(en.map((l) => l.traceIds)).toEqual(id.map((l) => l.traceIds));
    expect(en[0]!.name).toBe(`Main line ${result.mainFamily}`);
    expect(en[0]!.path).toBe('Water source → field');
    expect(en[1]!.path).toBe('Header → laterals');
    expect(en[2]!.name).toBe(result.pumpRequired ? 'Pump + pressure class' : 'Gravity flow');
  });

  it("'en': BOM - jumlah dan ukuran sama, nama dan satuan Inggris", () => {
    const id = irrigationBomItemsFrom(result, traces, 'id');
    const en = irrigationBomItemsFrom(result, traces, 'en');
    expect(en.map((i) => [i.quantity, i.size])).toEqual(id.map((i) => [i.quantity, i.size]));
    expect(en.map((i) => i.item)).toContain('Valve / stop cock');
    expect(en.map((i) => i.item)).toContain('HDPE pipe');
    expect(en.some((i) => (i.unit as string) === 'm')).toBe(true);
    expect(en.some((i) => (i.unit as string) === 'rods')).toBe(true);
    expect(en.map((i) => i.item)).not.toContain('Katup / stop kran');
  });

  it("'en': asumsi pertama berbahasa Inggris, asumsi masukan diteruskan", () => {
    const input = [{ text: 'x', fieldPath: 'irrigation.distance' }];
    const en = irrigationAssumptionsFrom(traces, input, 'en');
    expect(en[0]!.text).toMatch(/^How it is worked out: /);
    expect(en[0]!.text).not.toMatch(/ENG-\d/);
    // Penjelasan cara hitung, bukan asumsi yang bisa diperbaiki.
    expect(en[0]!.fieldPath).toBe('');
    expect(en).toHaveLength(2);
    expect(en[1]).toBe(input[0]);
  });

  it("'en': prosa membawa angka yang sama", () => {
    const en = irrigationProse(stats, result, 'en');
    expect(en.headline).toBe(
      `Preliminary irrigation estimate for 1 ha: main line ${result.mainSize}`,
    );
    for (const n of [stats.designFlowLs, result.distributionMeters, stats.productCount]) {
      expect(en.body).toContain(String(n));
    }
    expect(en.body).toContain(result.mainFamily);
    expect(en.body).toContain(`class ${result.pressureClass}`);
    expect(en.body).not.toMatch(/Debit|Jalur/);
  });
});

describe('irrigation-view: penjelasan trace dua bahasa (P15-04b)', () => {
  it("trace dihitung dengan 'en' → alasan dan dasar BOM berbahasa Inggris, ukuran sama", () => {
    const input = {
      areaHa: 1,
      method: 'sprinkler',
      mainRunMeters: 350,
      elevation: 'level',
    } as const;
    const enResult = computeIrrigation(input, 'en');
    const enTraces: readonly IdentifiedTrace[] = enResult.traces.map((t, i) => ({
      ...t,
      id: `I${i}`,
    }));
    const id = irrigationSystemLinesFrom(result, traces, 'id');
    const en = irrigationSystemLinesFrom(enResult, enTraces, 'en');
    expect(en.map((l) => l.traceIds)).toEqual(id.map((l) => l.traceIds));
    en.forEach((line, i) => expect(line.reason).not.toBe(id[i]!.reason));
    expect(en[0]!.reason).toContain('Design flow');
    expect(irrigationBomItemsFrom(enResult, enTraces, 'en')[0]!.basis).toContain('Field 1 ha');
  });
});
