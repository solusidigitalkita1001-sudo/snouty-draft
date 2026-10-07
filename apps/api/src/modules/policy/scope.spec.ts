/**
 * P5-01a — **TES RELEASE BLOCKER**: pertanyaan kompetitor tidak pernah menghasilkan
 * kartu produk kompetitor (docs/EVALUATION.md). Jangan pernah di-skip.
 *
 * Plus Policy 5 scope routing (SPEC §5).
 */
import { describe, expect, it } from 'vitest';
import {
  competitorPolicy,
  irrigationHandoffPolicy,
  neutralCriteria,
  NEUTRAL_CRITERIA_EN,
  technicalHandoffPolicy,
  NEUTRAL_CRITERIA,
  scopePolicy,
  useCasePolicy,
} from './scope.js';

describe('Policy 1 — hanya Pralon (RELEASE BLOCKER)', () => {
  it('pertanyaan kompetitor menghasilkan penolakan perbandingan, bukan rekomendasi', () => {
    const outcome = competitorPolicy();
    expect(outcome.kind).toBe('policy');
    if (outcome.kind !== 'policy') throw new Error('tak mungkin');
    expect(outcome.code).toBe('COMPETITOR_COMPARISON_REFUSED');
  });

  it('hasilnya tidak punya jalur untuk membawa produk sama sekali', () => {
    const outcome = competitorPolicy();
    // Bentuk hasilnya sendiri yang menjamin: tidak ada field produk untuk diisi.
    expect(Object.keys(outcome)).toEqual(['kind', 'code', 'reasons']);
    expect(JSON.stringify(outcome)).not.toMatch(/sku|productId|product/i);
  });

  it('kriteria netral tidak menyebut satu pun nama merek', () => {
    const joined = NEUTRAL_CRITERIA.join(' ').toLowerCase();
    for (const brand of ['pralon', 'rucika', 'wavin', 'maspion', 'vinilon']) {
      expect(joined).not.toContain(brand);
    }
  });

  it('kriteria netral tidak kosong — menolak tanpa menjelaskan bukan jawaban', () => {
    expect(NEUTRAL_CRITERIA.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Policy 5 — scope routing', () => {
  const base = {
    buildingType: 'residential' as const,
    installationType: 'clean_water' as const,
    floors: 2,
  };

  it('guna di luar cakupan dari pesannya (tambak, air panas) → validasi teknis; rumah dan irigasi → bukan urusan kebijakan ini', () => {
    expect(useCasePolicy('jalur air panas boiler hotel')).toMatchObject({
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
    });
    // Skenario uji §39: air proses pabrik bersuhu tinggi — dikenali dari "air proses" maupun suhunya.
    expect(useCasePolicy('Jalur air proses pabrik, suhu 70°C, panjang 200 meter').kind).toBe(
      'policy',
    );
    expect(useCasePolicy('pipa untuk air suhu 60 derajat').kind).toBe('policy');
    expect(useCasePolicy('rumah 2 lantai suhu 30 derajat di luar').kind).toBe('supported');
    // Tambak/kolam kini punya jalur kasus teknis sendiri (Fase 14) — bukan ditolak di sini.
    expect(useCasePolicy('pipa tambak udang 2 hektar').kind).toBe('supported');
    expect(useCasePolicy('rumah 2 lantai, 3 kamar mandi, toren atap').kind).toBe('supported');
    // Irigasi punya jalurnya sendiri (OQ-47) — bukan ditolak di sini.
    expect(useCasePolicy('irigasi sawah 1 hektar').kind).toBe('supported');
    expect(irrigationHandoffPolicy()).toMatchObject({
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
    });
  });

  it('air bersih rumah tinggal 2 lantai: didukung', () => {
    expect(scopePolicy(base).kind).toBe('supported');
  });

  it('industri: selalu validasi teknis', () => {
    const outcome = scopePolicy({ ...base, buildingType: 'industrial' });
    expect(outcome).toMatchObject({ kind: 'policy', code: 'TECHNICAL_VALIDATION_REQUIRED' });
  });

  it('industri menang atas jenis instalasi apa pun', () => {
    const outcome = scopePolicy({
      buildingType: 'industrial',
      installationType: 'drainage',
      floors: 1,
    });
    expect(outcome).toMatchObject({ code: 'TECHNICAL_VALIDATION_REQUIRED' });
  });

  it('bangunan lebih dari 4 lantai: validasi teknis', () => {
    expect(scopePolicy({ ...base, floors: 5 })).toMatchObject({
      code: 'TECHNICAL_VALIDATION_REQUIRED',
    });
    expect(scopePolicy({ ...base, floors: 4 }).kind).toBe('supported');
  });

  it('pembuangan: diakui dan dicatat, belum didukung penuh', () => {
    const outcome = scopePolicy({ ...base, installationType: 'drainage' });
    expect(outcome).toMatchObject({ kind: 'policy', code: 'SCOPE_NOT_YET_SUPPORTED' });
    if (outcome.kind !== 'policy') throw new Error('tak mungkin');
    // Mengakui lebih dulu, lalu menawarkan jalan keluar — bukan menolak kosong.
    expect(outcome.reasons[0]).toContain('dicatat');
    expect(outcome.reasons.join(' ')).toContain('tim teknis');
  });

  it('"keduanya" juga belum didukung penuh', () => {
    expect(scopePolicy({ ...base, installationType: 'both' })).toMatchObject({
      code: 'SCOPE_NOT_YET_SUPPORTED',
    });
  });

  it('field yang belum diketahui tidak memicu penolakan', () => {
    expect(scopePolicy({ buildingType: null, installationType: null, floors: null }).kind).toBe(
      'supported',
    );
  });
});

describe('Policy teks dwibahasa (Fase 15)', () => {
  it("'id' tidak berubah dan menjadi bawaan", () => {
    expect(
      scopePolicy({ buildingType: 'industrial', installationType: null, floors: null }),
    ).toEqual({
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: ['Instalasi industri memerlukan pemeriksaan tim teknis Pralon.'],
    });
    expect(competitorPolicy('id')).toEqual(competitorPolicy());
    expect(competitorPolicy('id')).toMatchObject({ reasons: NEUTRAL_CRITERIA });
  });

  it("'en' memberi teks Inggris dengan struktur dan kode yang sama", () => {
    const industrial = scopePolicy(
      { buildingType: 'industrial', installationType: null, floors: null },
      'en',
    );
    expect(industrial).toEqual({
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: ['Industrial installations require review by the Pralon technical team.'],
    });
    const floors = scopePolicy({ buildingType: null, installationType: null, floors: 6 }, 'en');
    expect(floors).toMatchObject({ reasons: [expect.stringContaining('6-storey')] });
    const drainage = scopePolicy(
      { buildingType: null, installationType: 'drainage', floors: null },
      'en',
    );
    expect(drainage).toMatchObject({ code: 'SCOPE_NOT_YET_SUPPORTED' });
    expect(irrigationHandoffPolicy('en')).toMatchObject({
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [expect.stringContaining('irrigation'), expect.stringContaining('technical team')],
    });
    expect(technicalHandoffPolicy('Fish Pond', 'en')).toMatchObject({
      reasons: [expect.stringContaining('fish pond data'), expect.any(String)],
    });
    expect(useCasePolicy('hot water for the boiler', 'en')).toMatchObject({
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [expect.stringContaining('outside the scope'), expect.any(String)],
    });
    expect(useCasePolicy('rumah 2 lantai', 'en')).toEqual({ kind: 'supported' });
    const competitor = competitorPolicy('en');
    expect(competitor).toMatchObject({ code: 'COMPETITOR_COMPARISON_REFUSED' });
  });

  it('NEUTRAL_CRITERIA_EN punya jumlah butir yang sama dan selektor memilihnya', () => {
    expect(NEUTRAL_CRITERIA_EN).toHaveLength(NEUTRAL_CRITERIA.length);
    expect(neutralCriteria('en')).toBe(NEUTRAL_CRITERIA_EN);
    expect(neutralCriteria('id')).toBe(NEUTRAL_CRITERIA);
  });
});
