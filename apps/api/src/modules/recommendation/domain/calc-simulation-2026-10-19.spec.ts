/**
 * Regresi simulasi perhitungan 2026-10-19 (P25-05): kasus teknis yang semua pertanyaannya dijawab
 * "Belum tahu" dulu dinyatakan "Datanya sudah cukup", lalu analisis gagal "layanan tidak tersedia".
 * Kini parameter kritis yang punya asumsi registry di profil kasus memakai asumsi itu (tercatat di
 * hasil), dan yang tidak punya tetap ditanya dengan penjelasan — tidak ada angka karangan.
 */
import { describe, expect, it } from 'vitest';
import { emptyRequirementState } from '../../context/domain/requirement-state.factory.js';
import {
  UNKNOWN,
  applyTechnicalAnswers,
  applyTechnicalFacts,
  isTechnicalComplete,
  technicalGuidance,
} from '../../context/domain/technical.js';
import { pressurizedPlanFrom } from './pressurized-view.js';
import { extractionToUpdates } from '../../context/application/extraction-to-updates.js';

const T0 = '2026-10-19T00:00:00.000Z';

function caseFrom(
  caseId: Parameters<typeof applyTechnicalFacts>[1],
  message: string,
  unknown: string[],
) {
  const started = applyTechnicalFacts(emptyRequirementState(T0), caseId, message).state;
  return applyTechnicalAnswers(
    started,
    unknown.map((key) => ({ key: key as never, value: UNKNOWN })),
  ).state;
}

describe('debit "Belum tahu" pada pompa yang mengisi tandon', () => {
  it('sumur bor 40 m ke tandon: debit pengisian 0,25 l/s dari registry, tercatat sebagai asumsi', () => {
    const state = caseFrom(
      'well_distribution',
      'sumur bor kedalaman 40 meter ke tandon atas rumah, jarak 15 meter',
      ['design_flow', 'tank_elevation'],
    );
    // Tinggi tandon tidak punya asumsi pengganti: tetap dibutuhkan.
    expect(isTechnicalComplete(state)).toBe(false);
    expect(technicalGuidance(state, 'id')).toContain('baru bisa dihitung kalau');

    const withElevation = applyTechnicalAnswers(state, [{ key: 'tank_elevation', value: 7 }]).state;
    expect(isTechnicalComplete(withElevation)).toBe(true);
    const plan = pressurizedPlanFrom(withElevation);
    expect(plan?.input.designFlowLs).toBe(0.25);
    expect(plan?.extraAssumptionIds).toContain('TANK_FILL_FLOW_0_25LS');
    expect(plan?.input.staticHeadM).toBe(47);
  });

  it('transfer pompa 100 m, beda tinggi 15 m: debit 0,25 l/s, rencana bisa dihitung', () => {
    const state = caseFrom(
      'pump_transfer',
      'transfer air pakai pompa dari tandon bawah ke tandon atas, jarak 100 meter, beda tinggi 15 meter',
      ['design_flow'],
    );
    expect(isTechnicalComplete(state)).toBe(true);
    expect(pressurizedPlanFrom(state)?.input).toMatchObject({
      designFlowLs: 0.25,
      routeLengthM: 100,
      staticHeadM: 15,
    });
  });
});

describe('parameter kritis tanpa asumsi pengganti tetap ditanya', () => {
  it('talang 150 m²: intensitas hujan "Belum tahu" — bukan "Datanya sudah cukup"', () => {
    const state = caseFrom('stormwater', 'talang air hujan atap rumah luas 150 m2', [
      'rainfall_intensity',
    ]);
    expect(isTechnicalComplete(state)).toBe(false);
    const text = technicalGuidance(state, 'id', { withIntro: false });
    expect(text).toContain('intensitas hujan');
    expect(text).not.toContain('Datanya sudah cukup');
  });
});

describe('jenis instalasi dari kalimat pengguna', () => {
  const installation = (message: string) =>
    extractionToUpdates({}, message).find((u) => u.path === 'water.installationType')?.value;

  it('"hitung pipa pembuangannya juga" bersama sumber air: air bersih dan pembuangan', () => {
    expect(
      installation('rumah 2 lantai, 3 kamar mandi, air dari PDAM, hitung pipa pembuangannya juga'),
    ).toBe('both');
  });

  it('pembuangan tanpa sumber air tetap pembuangan saja', () => {
    expect(installation('saluran pembuangan rumah 2 lantai ke septic tank')).toBe('drainage');
  });
});
