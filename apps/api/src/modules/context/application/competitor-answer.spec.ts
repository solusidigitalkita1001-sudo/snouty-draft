/**
 * Pertanyaan merek pesaing: merek lain tidak dinilai (Policy 1). Tanpa topik produk → profil Pralon;
 * dengan topik produk ("solvent cement Pralon vs lem lain") → fakta produk Pralon itu (uji sales
 * 2026-10-20).
 */
import { describe, expect, it } from 'vitest';
import { competitorAnswer } from './competitor-answer.js';

describe('competitorAnswer', () => {
  it('tanpa topik: profil Pralon yang terverifikasi', () => {
    const text = competitorAnswer('id');
    expect(text).toMatch(/^Merek lain tidak bisa saya nilai/);
    expect(text).toContain('**Standar dan sertifikasi**');
  });

  it('topik solvent cement: fakta solvent cement Pralon, bukan profil perusahaan umum', () => {
    const text = competitorAnswer('id', ['solvent cement']);
    expect(text).toMatch(/^Produk merek lain tidak bisa saya nilai/);
    expect(text).toContain('quick dry');
    expect(text).not.toContain('**Ragam produk**');
    expect(text).not.toMatch(/rucika|wavin|vinilon/i);
  });

  it('topik lepas lebih dari satu: tetap profil Pralon, bukan penjelasan PIPPO', () => {
    expect(competitorAnswer('id', ['pippo', 'proses produksi'])).toMatch(
      /^Merek lain tidak bisa saya nilai/,
    );
  });
});
