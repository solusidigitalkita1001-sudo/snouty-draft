/**
 * P31-83 — provenance mengikuti tanda tangan ahli. Yang dipaku: tanpa tanda tangan angka tetap
 * asumsi, tanda tangan hanya menaikkan versi yang ditandatangani, dimensi nyata tetap syarat
 * kedua untuk `VERIFIED`, menolak berarti nilainya hilang, dan aturan yang ditolak di kode tidak
 * bisa dihidupkan lewat basis data.
 */
import { describe, expect, it } from 'vitest';
import { signedProvenance, signedStatusFrom } from './signed-rules.js';

const trace = {
  ruleId: 'ENG-601',
  ruleVersion: 1,
  provenance: 'ASSUMED' as const,
  hasRealDimensions: true,
};

describe('provenance setelah tanda tangan', () => {
  it('tanpa tanda tangan, angkanya tetap asumsi', () => {
    expect(signedProvenance(trace, signedStatusFrom([]))).toBe('ASSUMED');
  });

  it('aturan yang ditandatangani dengan dimensi nyata menjadi terverifikasi', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-601', ruleVersion: 1, decision: 'approved' }]);
    expect(signedProvenance(trace, signed)).toBe('VERIFIED');
  });

  it('tanpa dimensi nyata, tanda tangan hanya sampai estimasi', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-601', ruleVersion: 1, decision: 'approved' }]);
    expect(signedProvenance({ ...trace, hasRealDimensions: false }, signed)).toBe('ESTIMATED');
    // Jejak lama tidak membawa kolom itu sama sekali; itu bukan "dimensi diketahui".
    expect(signedProvenance({ ...trace, hasRealDimensions: undefined }, signed)).toBe('ESTIMATED');
  });

  it('aturan yang ditolak ahli tidak menampilkan nilai', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-601', ruleVersion: 1, decision: 'rejected' }]);
    expect(signedProvenance(trace, signed)).toBe('UNAVAILABLE');
  });

  it('tanda tangan atas versi lain tidak ikut menaikkan', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-601', ruleVersion: 2, decision: 'approved' }]);
    expect(signedProvenance(trace, signed)).toBe('ASSUMED');
  });

  it('tanda tangan aturan lain tidak menular', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-701', ruleVersion: 1, decision: 'approved' }]);
    expect(signedProvenance(trace, signed)).toBe('ASSUMED');
  });

  it('aturan yang ditolak di dalam kode tidak bisa dihidupkan lewat basis data', () => {
    const signed = signedStatusFrom([{ ruleId: 'ENG-601', ruleVersion: 1, decision: 'approved' }]);
    expect(signedProvenance({ ...trace, provenance: 'UNAVAILABLE' }, signed)).toBe('UNAVAILABLE');
  });
});
