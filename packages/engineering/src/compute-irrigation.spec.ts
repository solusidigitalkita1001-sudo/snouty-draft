/**
 * Orkestrator irigasi: kasus pemilik (1 ha, sprinkler, sungai, <50 m, sejajar) keluar
 * masuk akal dan terlacak; semua trace ASSUMED; murni.
 */
import { describe, expect, it } from 'vitest';
import { computeIrrigation } from './compute-irrigation.js';

describe('computeIrrigation', () => {
  it('1 ha sprinkler, sumber sejajar 25 m: debit 0,8 l/s → 1" (dalam 29,6 mm), pompa, AW, PVC utama', () => {
    const r = computeIrrigation({
      areaHa: 1,
      method: 'sprinkler',
      mainRunMeters: 25,
      elevation: 'level',
    });
    expect(r.designFlowLs).toBe(0.8);
    expect(r.mainSize).toBe('1"');
    expect(r.pumpRequired).toBe(true);
    expect(r.pressureClass).toBe('AW');
    expect(r.mainFamily).toBe('PVC AW');
    expect(r.distributionMeters).toBe(200);
    expect(r.bom.map((l) => l.item)).toEqual([
      'Pipa PVC AW',
      'Pipa PVC AW',
      'Tee',
      'Elbow 90°',
      'Katup / stop kran',
    ]);
    // Bahan (ENG-104) dihitung sebelum ukuran (ENG-102): tabel ukuran jalur utama ikut bahannya.
    expect(r.traces.map((t) => t.ruleId)).toEqual([
      'ENG-101',
      'ENG-104',
      'ENG-102',
      'ENG-103',
      'ENG-105',
    ]);
    expect(r.traces.every((t) => t.provenance === 'ASSUMED')).toBe(true);
    expect(r.overallProvenance).toBe('ASSUMED');
  });

  it('1 ha genangan dari sumber lebih tinggi 350 m: gravitasi tanpa pompa, kelas D, HDPE utama per meter', () => {
    const r = computeIrrigation({
      areaHa: 1,
      method: 'flood',
      mainRunMeters: 350,
      elevation: 'higher',
    });
    expect(r.designFlowLs).toBe(1.5);
    // Jalur utama HDPE dipilih dari tabel mm (OD, SDR 17): 35,7 mm dalam → OD 50 mm (dalam 44,1 mm);
    // distribusi di lahan tetap PVC AW inci.
    expect(r.mainSize).toBe('50 mm');
    expect(r.distributionSize).toBe('1¼"');
    expect(r.pumpRequired).toBe(false);
    expect(r.pressureClass).toBe('D');
    expect(r.mainFamily).toBe('HDPE');
    expect(r.bom[0]).toEqual({ item: 'Pipa HDPE', size: '50 mm', quantity: 350, unit: 'meter' });
    expect(r.bom[1]).toMatchObject({ item: 'Pipa PVC AW', size: '1¼"' });
  });

  it('murni: masukan sama → keluaran identik', () => {
    const input = { areaHa: 2, method: 'drip', mainRunMeters: 125, elevation: 'lower' } as const;
    expect(computeIrrigation(input)).toEqual(computeIrrigation(input));
  });

  it('setiap trace membawa penjelasan dengan angka yang sama dengan keluarannya', () => {
    const r = computeIrrigation({
      areaHa: 1,
      method: 'sprinkler',
      mainRunMeters: 25,
      elevation: 'level',
    });
    expect(r.traces[0]?.explanation).toContain('0.8 l/s');
    expect(r.traces[2]?.explanation).toContain('1"');
  });
});
