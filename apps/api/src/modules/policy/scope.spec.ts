/**
 * P5-01a — **TES RELEASE BLOCKER**: pertanyaan kompetitor tidak pernah menghasilkan
 * kartu produk kompetitor (docs/EVALUATION.md). Jangan pernah di-skip.
 *
 * Plus Policy 5 scope routing (SPEC §5).
 */
import { describe, expect, it } from 'vitest';
import { competitorPolicy, NEUTRAL_CRITERIA, scopePolicy, useCasePolicy } from './scope.js';

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

  it('guna di luar cakupan dari pesannya (irigasi sawah, tambak, air panas) → validasi teknis; rumah → didukung', () => {
    const irrigation = useCasePolicy(
      'untuk bikin irigasi sawah dengan luas 1 hektar itu yang dibutuhin apa aja product nya?',
    );
    expect(irrigation).toMatchObject({ kind: 'policy', code: 'TECHNICAL_VALIDATION_REQUIRED' });
    expect(useCasePolicy('jalur air panas boiler hotel').kind).toBe('policy');
    expect(useCasePolicy('rumah 2 lantai, 3 kamar mandi, toren atap').kind).toBe('supported');
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
