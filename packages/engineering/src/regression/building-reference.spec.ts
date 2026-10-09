/**
 * Regresi gedung bertingkat dengan hitungan acuan INDEPENDEN (brief audit §9).
 *
 * Kasus awal brief — bukan rujukan teknik yang disetujui: 5 000 m² per lantai, 20 lantai, tinggi
 * 90 m, 10 m²/orang, 150 l/orang/hari, 10 jam, faktor jam puncak 2, menit puncak 3. Angka harapan
 * di sini dihitung ulang dengan rumus yang ditulis langsung di berkas ini (bukan dengan fungsi
 * engine) atau dengan tangan, supaya tes tidak hanya memeriksa engine terhadap dirinya sendiri.
 */
import { describe, expect, it } from 'vitest';
import { CaseInputInvalidError } from '../cases/validation.js';
import { computeBuildingWater } from '../compute-building.js';
import { RuleInputError } from '../rule.js';

const M_PER_BAR = 10.197;

/** Acuan: diameter dalam dari OD dan SDR. */
const innerMm = (odMm: number, sdr: number) => odMm - (2 * odMm) / sdr;
/** Acuan: kontinuitas. */
const velocity = (ls: number, idMm: number) => ls / 1000 / ((Math.PI * (idMm / 1000) ** 2) / 4);
/** Acuan: Hazen-Williams SI dengan eksponen buku teks 4,87. */
const hazenWilliams = (ls: number, idMm: number, lengthM: number, c: number) =>
  (10.67 * lengthM * (ls / 1000) ** 1.852) / (c ** 1.852 * (idMm / 1000) ** 4.87);

describe('regresi brief: 5 000 m² × 20 lantai, 90 m', () => {
  const r = computeBuildingWater({ floors: 20, floorAreaM2: 5000, floorHeightM: 4.5 });

  it('kebutuhan: 10 000 orang, 1 500 m³/hari, 150 m³/jam, jam puncak 300 m³/jam = 83,33 l/s', () => {
    expect(r.occupants).toBe(10_000); // 5 000 × 20 ÷ 10
    expect(r.demand.dailyM3).toBe(1_500); // 10 000 × 150 l
    expect(r.demand.averageHourM3h).toBe(150); // 1 500 ÷ 10 jam
    expect(r.demand.peakHourLs).toBeCloseTo(300 / 3.6, 6); // 2 × 150 m³/jam
    expect(r.demand.peakMinuteLs).toBeCloseTo(450 / 3.6, 6); // 3 × 150 m³/jam = 125 l/s
  });

  it('pompa transfer 300 m³/jam — tanpa pembulatan berantai (bukan 299,99)', () => {
    expect(r.transfer.pumpDuty!.flowM3h).toBe(300);
  });

  it('zona dari elevasi: booster 19–20, gravitasi 12–18, katup 5–11 dan 1–4; kaki riser 8,83 bar', () => {
    // Tekanan statik lantai k = (90 − 4,5·(k − 1)) m. Batas: 1 bar = 10,197 m, 4 bar = 40,788 m.
    // k = 20 → 4,5 m dan k = 19 → 9 m (< 10,197) → booster; k = 18 → 13,5 m.
    // k = 12 → 40,5 m ≤ 40,788; k = 11 → 45 m > batas → mulai zona berkatup.
    // Lantai per zona berkatup = ⌊(40,788 − 10,197) ÷ 4,5⌋ + 1 = 7 → 5–11, sisa 1–4.
    expect(r.zoning.zoneTable.map((z) => [z.kind, z.bottomFloor, z.topFloor])).toEqual([
      ['booster', 19, 20],
      ['gravity', 12, 18],
      ['reduced', 5, 11],
      ['reduced', 1, 4],
    ]);
    expect(r.zoning.zones).toBe(3);
    expect(r.zoning.boosterFloors).toBe(2);
    const gravity = r.zoning.zoneTable[1]!;
    expect(gravity.topPressureBar).toBeCloseTo(13.5 / M_PER_BAR, 2);
    expect(gravity.bottomPressureBar).toBeCloseTo(40.5 / M_PER_BAR, 2);
    const lowest = r.zoning.zoneTable[3]!;
    expect(lowest.bottomPressureBar).toBeCloseTo((10.197 + 3 * 4.5) / M_PER_BAR, 2);
    expect(r.zoning.riserBaseStaticBar).toBeCloseTo(90 / M_PER_BAR, 2);
    for (const z of r.zoning.zoneTable.filter((x) => x.kind !== 'booster')) {
      expect(z.bottomPressureBar).toBeLessThanOrEqual(4);
      expect(z.topPressureBar).toBeGreaterThanOrEqual(1);
    }
  });

  it('tangki: bawah 1 500 m³; atap (125 − 83,33) l/s × 30 menit + 83,33 l/s × 10 menit = 125 m³', () => {
    expect(r.tanks.groundTankM3).toBe(1_500);
    expect(r.tanks.roofPeakDeficitM3).toBeCloseTo(((125 - 300 / 3.6) * 30 * 60) / 1000, 1);
    expect(r.tanks.roofPumpCycleM3).toBeCloseTo(((300 / 3.6) * 10 * 60) / 1000, 1);
    expect(r.tanks.roofTankM3).toBe(125);
  });

  it('riser: diameter dalam 6" dari OD 165 mm (bukan 150 mm), kecepatan per riser dalam batas', () => {
    expect(r.riser.recommendedSize).toBe('6"');
    expect(r.riser.innerDiameterMm).toBeCloseTo(innerMm(165, 26.5), 1);
    expect(r.riser.innerDiameterMm).not.toBe(150);
    const perRiser = 125 / r.risers;
    expect(r.riser.velocityMs).toBeCloseTo(velocity(perRiser, innerMm(165, 26.5)), 2);
    expect(r.riser.velocityMs).toBeLessThanOrEqual(2);
    // Satu ukuran lebih kecil (4", OD 114) tidak lolos batas kecepatan pada debit yang sama —
    // itulah sebabnya riser dibagi, bukan dikecilkan.
    expect(velocity(perRiser, innerMm(114, 26.5))).toBeGreaterThan(2);
  });

  it('transfer: kecepatan dan kerugian gesek cocok dengan hitungan acuan; TDH = statik + gesek + minor + sisa', () => {
    const od = Number.parseInt(r.transfer.recommendedSize, 10);
    expect(r.transferMaterial).toBe('HDPE');
    const id = innerMm(od, 17);
    expect(r.transfer.innerDiameterMm).toBeCloseTo(id, 1);
    expect(r.transfer.velocityMs).toBeCloseTo(velocity(300 / 3.6, id), 2);
    const hf = hazenWilliams(300 / 3.6, id, 90, 150);
    expect(Math.abs(r.transfer.frictionLossM - hf) / hf).toBeLessThan(0.01);
    const tdh = 90 + r.transfer.frictionLossM + r.transfer.minorLossM + 0.5 * M_PER_BAR; // margin buang 0,5 bar
    expect(r.transfer.totalDynamicHeadM).toBeCloseTo(tdh, 1);
  });

  it('daya pompa: hidraulik = ρgQH; poros = hidraulik ÷ η pompa; tidak disebut daya motor', () => {
    const duty = r.transfer.pumpDuty!;
    const hydraulicKw = (9.81 * (300 / 3.6) * duty.headM) / 1000;
    expect(duty.hydraulicPowerKw).toBeCloseTo(hydraulicKw, 1);
    expect(duty.indicativeShaftPowerKw).toBeCloseTo(hydraulicKw / 0.6, 1);
    expect(duty.differentialPressureBar).toBeCloseTo(duty.headM / M_PER_BAR, 2);
    const explanation = r.traces.find((t) => t.ruleId === 'ENG-206')!.explanation;
    expect(explanation).toContain('porosnya');
    expect(explanation).not.toMatch(/motornya sekitar/);
  });
});

describe('masukan tidak valid → galat eksplisit, bukan angka yang tampak masuk akal', () => {
  it('20 lantai setinggi 10 m (0,5 m per lantai) ditolak dengan pertanyaan tinggi gedung', () => {
    try {
      computeBuildingWater({ floors: 20, floorAreaM2: 5000, floorHeightM: 0.5 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CaseInputInvalidError);
      const issues = (error as CaseInputInvalidError).issues;
      expect(issues.map((i) => i.parameter)).toEqual(['building_height']);
      expect(issues[0]!.message).toContain('0,5 m per lantai');
    }
  });

  it('10 000 orang di 20 lantai × 100 m² ditolak (kurang dari 1 m² per orang)', () => {
    expect(() => computeBuildingWater({ floors: 20, occupants: 10_000, floorAreaM2: 100 })).toThrow(
      CaseInputInvalidError,
    );
  });

  it('tekanan sisa 5 bar dengan batas zona 4 bar tidak bisa dipenuhi', () => {
    expect(() =>
      computeBuildingWater({ floors: 20, occupants: 1000, residualPressureBar: 5 }),
    ).toThrow(CaseInputInvalidError);
  });

  it('jumlah lantai nol dan luas negatif ditolak', () => {
    expect(() => computeBuildingWater({ floors: 0, occupants: 100 })).toThrow(
      CaseInputInvalidError,
    );
    expect(() => computeBuildingWater({ floors: 5, floorAreaM2: -10 })).toThrow(RuleInputError);
  });
});
