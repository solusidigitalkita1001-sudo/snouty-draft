/**
 * Masukan Leo (2026-10-22) atas laporan SNTY-2026-10-0020:
 *
 *   "yang bagian perhitungan panjang pipa nya perlu di kaji lagi, soalnya kalo disitu kan
 *    ngitungnya pipa sisa itu di asumsikan bisa langsung nyambung ya?, kan butuh socket buat
 *    nyambungnya lagi, kalo yg kyk rumus rumus pressure loss di pipa sama fitting nya gw gk bisa
 *    langsung cek gitu.. kan harus diitung dulu"
 *
 * Dua hal yang diuji di sini, keduanya dari sudut pandang pemeriksa:
 *
 *   1. Angka kehilangan tekanan bisa dihitung ulang DARI LUAR engine. Tes ini menghitung sendiri
 *      Hazen-Williams, kecepatan, dan ΣK·v²/2g dengan rumus telanjang, lalu membandingkannya —
 *      kalau rumus di engine berubah diam-diam, tes ini gagal.
 *   2. Rumus yang tercetak di laporan memuat satuan yang benar-benar masuk ke rumusnya (m³/s, m),
 *      bukan hanya l/s dan mm, sehingga bisa disubstitusikan tanpa menebak konversinya.
 */

import { describe, expect, it } from 'vitest';
import { computeSolution, type SolutionInput } from './compute-solution.js';
import { pipeJointsPerRun } from './rules/group-c-material.js';
import { stepFormula } from './rules/step-formulas.js';

/** Rumah pada laporan SNTY-2026-10-0020: 2 lantai, 2 kamar mandi, PDAM, 12 × 7 m di tanah 15 × 10 m. */
const LEO_HOUSE: SolutionInput = {
  buildingType: 'residential',
  floors: 2,
  bathrooms: 2,
  basins: 1,
  kitchens: 1,
  waterSource: 'municipal',
  installationType: 'clean_water',
  floorHeightM: null,
  mainRunMeters: null,
  planLengthM: 12,
  planWidthM: 7,
  landLengthM: 15,
  landWidthM: 10,
};

const G = 9.81;

/** Hazen-Williams SI, ditulis ulang di sini dengan sengaja — bukan dipanggil dari engine. */
function hazenWilliams(flowLs: number, innerMm: number, lengthM: number, c: number): number {
  const q = flowLs / 1000;
  const d = innerMm / 1000;
  return (10.67 * lengthM * q ** 1.852) / (c ** 1.852 * d ** 4.8704);
}

describe('kehilangan tekanan bisa dihitung ulang dari luar engine (masukan Leo)', () => {
  const result = computeSolution(LEO_HOUSE);
  const main = result.supply.main;

  it('kecepatan = debit ÷ luas penampang', () => {
    const innerM = main.innerDiameterMm / 1000;
    const areaM2 = (Math.PI * innerM ** 2) / 4;
    const byHand = result.supply.peakFlowLs / 1000 / areaM2;
    expect(main.velocityMs).toBeCloseTo(byHand, 2);
  });

  it('kehilangan di pipa lurus = Hazen-Williams atas panjang jalur', () => {
    const byHand = hazenWilliams(
      result.supply.peakFlowLs,
      main.innerDiameterMm,
      result.supply.routeLengthM,
      main.hazenWilliamsC,
    );
    expect(main.frictionLossM).toBeCloseTo(byHand, 2);
  });

  it('kehilangan di sambungan = ΣK × v²/2g atas fitting yang memang ada di jalur', () => {
    const detail = main.minorLossDetail;
    expect(detail).not.toBeNull();
    const sumK = detail!.items.reduce((sum, item) => sum + item.count * item.k, 0);
    const byHand = sumK * (main.velocityMs ** 2 / (2 * G));
    expect(detail!.totalK).toBeCloseTo(sumK, 2);
    expect(detail!.minorLossM).toBeCloseTo(byHand, 2);
    expect(main.minorLossM).toBe(detail!.minorLossM);
  });

  it('tiap suku kerugian sambungan punya jenis, jumlah, dan K sendiri — bukan satu angka gelap', () => {
    const items = main.minorLossDetail!.items;
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const item of items) {
      expect(item.kind.length).toBeGreaterThan(0);
      expect(item.count).toBeGreaterThan(0);
      expect(item.k).toBeGreaterThan(0);
      expect(item.lossM).toBeCloseTo(item.count * item.k * (main.velocityMs ** 2 / (2 * G)), 2);
    }
    // Sok antar batang ikut dihitung: itu justru yang hilang sebelum masukan Leo.
    expect(items.some((item) => item.kind.toLowerCase().includes('sok'))).toBe(true);
  });

  it('tinggi angkat total = beda tinggi + pipa + sambungan + sisa tekanan', () => {
    const residualM =
      main.totalDynamicHeadM - result.supply.staticHeadM - main.frictionLossM - main.minorLossM;
    expect(residualM).toBeGreaterThan(0);
    expect(main.totalDynamicHeadM).toBeCloseTo(
      result.supply.staticHeadM + main.frictionLossM + main.minorLossM + residualM,
      2,
    );
  });
});

describe('rumus yang tercetak memuat satuan yang dipakai rumusnya', () => {
  const result = computeSolution(LEO_HOUSE);
  const traceOf = (ruleId: string) => result.traces.find((t) => t.ruleId === ruleId)!;

  it('Hazen-Williams menyebut m³/s dan m, bukan hanya l/s dan mm', () => {
    const trace = traceOf('ENG-202');
    const text = stepFormula('ENG-202', trace.inputs, trace.output, 'id', trace.ruleVersion)!;
    expect(text).toContain('m³/s');
    expect(text).toMatch(/d .* mm = .* m /);
  });

  it('kecepatan menyebut luas dalam m², bukan hanya mm²', () => {
    const trace = traceOf('ENG-201');
    const text = stepFormula('ENG-201', trace.inputs, trace.output, 'id', trace.ruleVersion)!;
    expect(text).toContain('m³/s');
    expect(text).toContain('m²');
  });

  it('kerugian sambungan tercetak suku per suku dengan K-nya', () => {
    const trace = traceOf('ENG-207');
    const text = stepFormula('ENG-207', trace.inputs, trace.output, 'id', trace.ruleVersion)!;
    expect(text).toContain('ΣK');
    expect(text).toContain('19,62');
    expect(text).toContain('Sok antar batang pipa');
  });
});

describe('sok antar batang pipa (masukan Leo: pipa sisa tidak menyambung sendiri)', () => {
  it('jalur menerus 27,5 m dari batang 4 m butuh 6 sambungan', () => {
    expect(pipeJointsPerRun(27.5, 4)).toBe(6);
  });

  it('jalur yang lebih pendek dari satu batang tidak butuh sok', () => {
    expect(pipeJointsPerRun(1.5, 4)).toBe(0);
    expect(pipeJointsPerRun(4, 4)).toBe(0);
  });

  it('tepat dua batang → satu sambungan', () => {
    expect(pipeJointsPerRun(8, 4)).toBe(1);
    expect(pipeJointsPerRun(8.1, 4)).toBe(2);
  });

  it('sok di jalur utama ikut menambah kehilangan tekanan', () => {
    const items = computeSolution(LEO_HOUSE).supply.main.minorLossDetail!.items;
    const sockets = items.find((item) => item.kind.toLowerCase().includes('sok'))!;
    expect(sockets.count).toBe(pipeJointsPerRun(computeSolution(LEO_HOUSE).supply.routeLengthM, 4));
  });
});
