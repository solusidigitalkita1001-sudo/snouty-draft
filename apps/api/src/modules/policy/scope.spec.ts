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
    const joined = NEUTRAL_CRITERIA.map((c) => `${c.label} ${c.detail}`)
      .join(' ')
      .toLowerCase();
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

  it('fluida di luar cakupan atau suhu ≥ 45 °C → validasi teknis; selain itu bukan urusan kebijakan ini', () => {
    // Kebijakan leaf menerima isyarat yang sudah dibaca (P16-14): nama fluida dari kosakata data,
    // suhu dari parser angka — pembacaannya diuji di context (english-understanding.spec).
    expect(useCasePolicy({ outOfScopeFluid: true, temperatureC: null })).toMatchObject({
      kind: 'policy',
      code: 'TECHNICAL_VALIDATION_REQUIRED',
    });
    // Skenario uji §39: air proses pabrik bersuhu tinggi.
    expect(useCasePolicy({ outOfScopeFluid: false, temperatureC: 70 }).kind).toBe('policy');
    expect(useCasePolicy({ outOfScopeFluid: false, temperatureC: 45 }).kind).toBe('policy');
    expect(useCasePolicy({ outOfScopeFluid: false, temperatureC: 30 }).kind).toBe('supported');
    // Tambak, rumah, irigasi: tidak ada fluida/suhu di luar cakupan — bukan ditolak di sini.
    expect(useCasePolicy({ outOfScopeFluid: false, temperatureC: null }).kind).toBe('supported');
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

  // Produksi 2026-10-27: sekolah 3 lantai dengan 24 toilet — di bawah batas lantai, tetapi
  // beban alatnya di luar kurva debit puncak, dan analisisnya gagal tanpa penjelasan.
  it('beban alat di atas kurva debit puncak: validasi teknis, dengan angkanya disebut', () => {
    const outcome = scopePolicy({ ...base, floors: 3, supplyLoadWsfu: 156 });
    expect(outcome).toMatchObject({ code: 'TECHNICAL_VALIDATION_REQUIRED' });
    expect(outcome.kind === 'policy' && outcome.reasons[0]).toContain('156 unit');
    expect(outcome.kind === 'policy' && outcome.reasons[0]).toContain('tim teknis Pralon');
    const en = scopePolicy({ ...base, floors: 3, supplyLoadWsfu: 156 }, 'en');
    expect(en.kind === 'policy' && en.reasons[0]).toContain('156 units');
    // Di dalam tabel: dihitung seperti biasa.
    expect(scopePolicy({ ...base, supplyLoadWsfu: 100 }).kind).toBe('supported');
    expect(scopePolicy({ ...base, supplyLoadWsfu: null }).kind).toBe('supported');
  });

  it('pembuangan dan "keduanya" dihitung, tidak diteruskan ke tim teknis (laporan pemilik 2026-10-12)', () => {
    expect(scopePolicy({ ...base, installationType: 'drainage' }).kind).toBe('supported');
    expect(scopePolicy({ ...base, installationType: 'both' }).kind).toBe('supported');
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
    expect(competitorPolicy('id')).toMatchObject({
      reasons: NEUTRAL_CRITERIA.map((c) => c.detail),
    });
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
    expect(drainage.kind).toBe('supported');
    expect(irrigationHandoffPolicy('en')).toMatchObject({
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [expect.stringContaining('irrigation'), expect.stringContaining('technical team')],
    });
    expect(technicalHandoffPolicy('Fish Pond', 'en')).toMatchObject({
      reasons: [expect.stringContaining('fish pond data'), expect.any(String)],
    });
    expect(useCasePolicy({ outOfScopeFluid: true, temperatureC: null }, 'en')).toMatchObject({
      code: 'TECHNICAL_VALIDATION_REQUIRED',
      reasons: [
        expect.stringContaining('special fluids need a different pipe choice'),
        expect.any(String),
      ],
    });
    expect(useCasePolicy({ outOfScopeFluid: false, temperatureC: null }, 'en')).toEqual({
      kind: 'supported',
    });
    const competitor = competitorPolicy('en');
    expect(competitor).toMatchObject({ code: 'COMPETITOR_COMPARISON_REFUSED' });
  });

  it('NEUTRAL_CRITERIA_EN punya jumlah butir yang sama dan selektor memilihnya', () => {
    expect(NEUTRAL_CRITERIA_EN).toHaveLength(NEUTRAL_CRITERIA.length);
    expect(neutralCriteria('en')).toBe(NEUTRAL_CRITERIA_EN);
    expect(neutralCriteria('id')).toBe(NEUTRAL_CRITERIA);
  });
});
