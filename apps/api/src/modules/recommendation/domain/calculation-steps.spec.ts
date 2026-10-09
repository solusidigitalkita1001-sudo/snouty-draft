/**
 * Panel detail teknis: langkah hitung bernomor per baris sistem, judul dari engine, tanpa kode
 * aturan, angka berformat Indonesia (laporan pemilik 2026-10-09).
 */
import { computeBuildingWater } from '@snouty/engineering';
import { describe, expect, it } from 'vitest';
import { buildingSystemLines } from './building-water-view.js';
import { readableNumbers, stepsFor } from './calculation-steps.js';
import type { IdentifiedTrace } from './solution-view.js';

describe('langkah hitung', () => {
  const result = computeBuildingWater({ floors: 12, floorAreaM2: 3000 });
  const traces: IdentifiedTrace[] = result.traces.map((t, i) => ({ ...t, id: `T${i}` }));

  it('pipa transfer: kebutuhan air → pilih ukuran → kecepatan → kehilangan tekanan → tinggi angkat → pompa', () => {
    const transfer = buildingSystemLines(result, traces)[0]!;
    const steps = stepsFor(transfer.traceIds, traces, 'id');
    expect(steps.map((s) => s.title)).toEqual([
      'Perkiraan penghuni',
      'Kebutuhan air harian dan puncak',
      'Zona tekanan dan booster',
      'Pilih ukuran pipa',
      'Kecepatan air',
      'Kehilangan tekanan di pipa',
      'Kehilangan di sambungan',
      'Tinggi angkat total',
      'Pompa yang dibutuhkan',
    ]);
    for (const step of steps) {
      expect(step.text).not.toMatch(/ENG-\d/);
      expect(step.text).not.toMatch(/\d\.\d/);
    }
    expect(steps[3]!.text).toContain('Dicoba 10 ukuran; 6" yang terkecil');
  });

  it('desimal Indonesia memakai koma; Inggris tetap titik', () => {
    expect(readableNumbers('kerugian 0.65 m, daya 14.073 kW, 3600 orang', 'id')).toBe(
      'kerugian 0,65 m, daya 14,073 kW, 3600 orang',
    );
    expect(readableNumbers('loss 0.65 m', 'en')).toBe('loss 0.65 m');
  });
});
