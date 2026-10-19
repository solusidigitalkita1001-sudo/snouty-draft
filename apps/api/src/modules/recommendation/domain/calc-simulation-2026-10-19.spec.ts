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
import { gravityPlanFrom } from './gravity-view.js';
import { extensionOnly } from './extension-view.js';
import type { Recommendation } from '@snouty/shared-types';
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
  it('talang 150 m²: intensitas hujan "Belum tahu" memakai 150 mm/jam dari registry (keputusan pemilik)', () => {
    const state = caseFrom('stormwater', 'talang air hujan atap rumah luas 150 m2', [
      'rainfall_intensity',
    ]);
    expect(isTechnicalComplete(state)).toBe(true);
    expect(gravityPlanFrom(state)?.input).toEqual({ kind: 'stormwater', catchmentHa: 0.015 });
  });

  it('cluster 50 rumah: beda tinggi "Belum tahu" tetap ditanya — bukan "Datanya sudah cukup"', () => {
    const state = caseFrom(
      'residential_cluster',
      'jaringan air bersih cluster 50 rumah, pipa utama 400 meter dari PDAM',
      ['static_head'],
    );
    expect(isTechnicalComplete(state)).toBe(false);
    const text = technicalGuidance(state, 'id', { withIntro: false });
    expect(text).toContain('baru bisa dihitung kalau');
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

describe('tinggi toren atap dari jumlah lantai (temuan simulasi)', () => {
  it('sumur 40 m ke toren atap rumah 2 lantai: tinggi 2 × 3,5 + 1 = 8 m, head statis 48 m', () => {
    const state = caseFrom(
      'well_distribution',
      'sumur bor kedalaman 40 meter ke toren atap rumah 2 lantai, jarak 15 meter',
      ['design_flow'],
    );
    expect(isTechnicalComplete(state)).toBe(true);
    const plan = pressurizedPlanFrom(state);
    expect(plan?.input.staticHeadM).toBe(48);
    expect(plan?.extraAssumptionIds).toEqual(
      expect.arrayContaining(['TANK_FILL_FLOW_0_25LS', 'FLOOR_HEIGHT_3_5M', 'TANK_STAND_1M']),
    );
  });
});

describe('perluasan: rumah yang disebut = beban lama, "tambah N titik" = beban baru (keputusan pemilik)', () => {
  const MESSAGE =
    'rumah 2 lantai, 3 kamar mandi, 2 wastafel, 1 dapur, toren atap. mau tambah 2 titik air di lantai 2, pipa utama lama 3/4 inch';
  const updates = extractionToUpdates({}, MESSAGE);
  const value = (path: string) => updates.find((u) => u.path === path)?.value;

  it('"tambah 2 titik air" terbaca sebagai titik tambahan, bukan jumlah titik air rumah', () => {
    expect(value('water.addedOutlets')).toBe(2);
    expect(value('water.workType')).toBe('extend');
    expect(value('fixtures.outletCount')).toBeUndefined();
    expect(value('fixtures.bathrooms')).toBe(3);
  });

  it('material hanya untuk titik baru: 2 × 1,5 m + 10 % = 3,3 m → 1 batang, 2 elbow, 2 drat kran', () => {
    const base = {
      headline: 'Sistem distribusi untuk 9 titik air',
      body: '',
      stats: { fixtureConnectionSize: '1/2"' },
      products: [
        {
          role: 'fixture',
          size: '1/2"',
          name: 'Pipa (TS End) Abu AW 1/2" x 4 Meter',
          productId: 'P1',
        },
      ],
      bom: [
        {
          item: 'Pipa',
          size: '1¼"',
          quantity: 6,
          unit: 'batang',
          basis: '',
          provenance: 'ASSUMED',
          traceIds: [],
        },
        {
          item: 'Elbow',
          size: '1/2"',
          quantity: 13,
          unit: 'pcs',
          basis: '',
          provenance: 'ASSUMED',
          traceIds: [],
          productId: 'E1',
        },
        {
          item: 'Faucet elbow',
          size: '1/2"',
          quantity: 11,
          unit: 'pcs',
          basis: '',
          provenance: 'ASSUMED',
          traceIds: [],
          productId: 'F1',
        },
      ],
      assumptions: [],
    } as unknown as Recommendation;
    const r = extensionOnly(base, 2, 9, 'id');
    expect(r.headline).toBe('2 titik air baru di rumah dengan 9 titik air');
    const row = (purpose: string) => r.bom.find((b) => b.purpose === purpose);
    expect(row('Pipa ke titik air baru')).toMatchObject({
      quantity: 1,
      unit: 'batang',
      productId: 'P1',
    });
    expect(row('Elbow ke alat')).toMatchObject({ quantity: 2, productId: 'E1' });
    expect(row('Drat kran')).toMatchObject({ quantity: 2, productId: 'F1' });
    expect(row('Dari pipa lama ke titik baru')).toMatchObject({ pending: true, quantity: 0 });
    // Pipa utama rumah lama tidak dibeli ulang.
    expect(r.bom.some((b) => b.size === '1¼"')).toBe(false);
  });
});
