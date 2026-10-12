import { describe, expect, it } from 'vitest';
import { computeSolution } from '../compute-solution.js';
import { stepFormula } from './step-formulas.js';

// Rumah contoh kerja desain: 2 lantai, 3 kamar mandi, 4 wastafel, 1 dapur, toren atap.
const result = computeSolution({
  buildingType: 'residential',
  floors: 2,
  bathrooms: 3,
  basins: 4,
  kitchens: 1,
  waterSource: 'rooftop_tank',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
});
const formula = (ruleId: string, locale: 'id' | 'en' = 'id') => {
  const trace = result.traces.find((t) => t.ruleId === ruleId)!;
  return stepFormula(ruleId, trace.inputs, trace.output, locale);
};

describe('rumus singkat langkah hitung', () => {
  it('titik air dan beban suplai ditulis sebagai rumus dengan angka trace', () => {
    expect(formula('ENG-001')).toBe(
      'Titik air = 3 kamar mandi × 2 + 4 wastafel + 1 dapur = 11 titik',
    );
    expect(formula('ENG-701')).toBe(
      'Beban = 3 × 2,2 + 3 × 1 + 4 × 0,5 + 1 × 1 = 12,6 unit → Q = 1,03 l/s (kurva Hunter)',
    );
  });

  it('setiap langkah rumah yang punya rumus memakai desimal sesuai bahasa', () => {
    for (const trace of result.traces) {
      const id = stepFormula(trace.ruleId, trace.inputs, trace.output, 'id');
      const en = stepFormula(trace.ruleId, trace.inputs, trace.output, 'en');
      if (id === null) continue;
      expect(id).not.toContain('?');
      expect(en).not.toBeNull();
      expect(en).not.toMatch(/\d,\d/);
    }
    expect(formula('ENG-701', 'en')).toContain('12.6 units');
  });

  it('aturan tanpa rumus atau trace yang tidak dikenali → null, bukan rumus setengah', () => {
    expect(stepFormula('ENG-999', {}, {})).toBeNull();
    expect(stepFormula('ENG-001', { bathrooms: 3 }, {})).toBeNull();
  });
});

describe('panjang jalur rumah dari ukuran rumah (P16-60)', () => {
  const sized = computeSolution({
    buildingType: 'residential',
    floors: 2,
    bathrooms: 3,
    basins: 0,
    kitchens: 1,
    waterSource: 'municipal',
    installationType: 'both',
    floorHeightM: null,
    mainRunMeters: null,
    planLengthM: 12,
    planWidthM: 8,
  });

  it('cabang = jumlah cabang × sisi terpanjang rumah; sambungan 1,5 m per titik; 1 tee per cabang', () => {
    // 3 KM × 2 + 1 dapur = 7 titik; lantai 2: 4 titik, lantai 1: 3 titik → 2 cabang.
    expect(sized.branchLayout).toMatchObject({ branchNetM: 24, fixtureNetM: 10.5, teeCount: 2 });
    // ENG-707: cabang lantai 2 (2 KM, 6,4 WSFU ≈ 0,7 l/s → 1") dan lantai 1 (1 KM + dapur, 4,2 WSFU
    // → 3/4"), masing-masing sepanjang sisi terpanjang 12 m.
    expect(sized.branchLayout!.bySize).toEqual([
      { size: '1"', count: 1, netM: 12 },
      { size: '3/4"', count: 1, netM: 12 },
    ]);
    const trace = sized.traces.find((t) => t.ruleId === 'ENG-704')!;
    expect(stepFormula('ENG-704', trace.inputs, trace.output)).toBe(
      'Cabang = 2 × 12 m = 24 m · Sambungan = 7 × 1,5 m = 10,5 m · Tee = 2',
    );
  });

  it('tanpa ukuran rumah tidak ada perkiraan cabang', () => {
    expect(result.branchLayout).toBeNull();
    expect(result.traces.some((t) => t.ruleId === 'ENG-704')).toBe(false);
  });
});

describe('tanah dan bangunan dibedakan (2026-10-12)', () => {
  const base = {
    buildingType: 'residential' as const,
    floors: 2,
    bathrooms: 3,
    basins: 0,
    kitchens: 1,
    installationType: 'both' as const,
    floorHeightM: null,
    mainRunMeters: null,
    planLengthM: 8,
    planWidthM: 12,
    landLengthM: 10,
    landWidthM: 20,
  };

  it('PDAM: halaman 20 − 12 = 8 m masuk jalur pipa utama (5,5 + 20 + 8 = 33,5 m)', () => {
    const r = computeSolution({ ...base, waterSource: 'municipal' });
    expect(r.yardM).toBe(8);
    expect(r.mainRunNetM).toBe(33.5);
    const trace = r.traces.find((t) => t.ruleId === 'ENG-702')!;
    expect(stepFormula('ENG-702', trace.inputs, trace.output)).toBe(
      'Beda tinggi = 5,5 m · Panjang jalur = 5,5 tegak + 20 datar + halaman 8 = 33,5 m',
    );
  });

  it('toren atap: toren di bangunan, halaman tidak masuk jalur toren → titik air', () => {
    const r = computeSolution({ ...base, waterSource: 'rooftop_tank' });
    expect(r.yardM).toBe(8);
    expect(r.mainRunNetM).toBe(22.5);
  });

  it('toren atap: pipa pengisi dari depan tanah = halaman 8 + bangunan 12 + toren 8 = 28 m, 3/4" asumsi', () => {
    const r = computeSolution({ ...base, waterSource: 'rooftop_tank' });
    expect(r.tankFill).toEqual({ netM: 28, size: '3/4"' });
    expect(r.appliedAssumptionIds).toContain('TANK_FILL_PIPE_3_4IN');
    const trace = r.traces.find((t) => t.ruleId === 'ENG-706')!;
    expect(stepFormula('ENG-706', trace.inputs, trace.output)).toBe(
      'Pipa pengisi toren = 8 + 12 + 8 = 28 m',
    );
    // PDAM langsung: tidak ada toren atap, tidak ada pipa pengisi.
    expect(computeSolution({ ...base, waterSource: 'municipal' }).tankFill).toBeNull();
  });

  it('tanpa ukuran tanah tidak ada halaman', () => {
    const r = computeSolution({
      ...base,
      waterSource: 'municipal',
      landLengthM: null,
      landWidthM: null,
    });
    expect(r.yardM).toBeNull();
    expect(r.mainRunNetM).toBe(25.5);
  });
});

describe('rumus mengikuti versi trace (laporan 0010)', () => {
  it('ENG-603 v1/v2: air bekas tanpa jalur turun — tidak ditulis "15 + 3,5 × (2 − 1) = 15 m"', () => {
    const inputs = { planLengthM: 15, floors: 2, floorHeightM: 3.5, ventAboveRoofM: 1, yardM: 0 };
    const output = { soilNetM: 18.5, wasteNetM: 15, soilVentNetM: 8, wasteVentNetM: 8 };
    const old = stepFormula('ENG-603', inputs, output, 'id', 1)!;
    expect(old).toContain('Air bekas = 15 m');
    expect(old).not.toContain('Air bekas = 15 + 3,5');
    expect(stepFormula('ENG-603', inputs, { ...output, wasteNetM: 18.5 }, 'id', 3)).toContain(
      'Air bekas = 15 + 3,5 × (2 − 1) = 18,5 m',
    );
  });
});
