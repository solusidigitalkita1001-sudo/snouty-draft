/**
 * Produksi 2026-10-26: "udah, itung" di proyek renovasi ruko dijawab "Kebutuhan Anda tetap tercatat
 * seperti di panel. Bagian mana yang mau diubah atau ditanyakan?" — padahal yang kurang jelas.
 */
import { describe, expect, it } from 'vitest';
import { missingForCalculationReply } from './reply-copy.js';

describe('permintaan menghitung yang masih menunggu data', () => {
  it('menyebut data yang ditunggu, dalam bahasa pengguna', () => {
    const text = missingForCalculationReply(
      ['water.source', 'water.installationType', 'fixtures.bathrooms'],
      'id',
    );
    expect(text).toContain('sumber air');
    expect(text).toContain('jenis instalasi');
    expect(text).toContain('kamar mandi');
    expect(text).not.toContain('water.');
  });

  it('bahasa Inggris memakai label Inggris', () => {
    expect(missingForCalculationReply(['fixtures.bathrooms'], 'en')).toContain('bathrooms');
  });

  it('tidak ada yang kurang: tidak ada kalimat ini', () => {
    expect(missingForCalculationReply([], 'id')).toBeNull();
  });
});
