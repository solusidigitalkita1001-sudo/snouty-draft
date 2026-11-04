/**
 * Kesetaraan mm ↔ inci dari tabel ukuran resmi (P34-17). Yang dipaku: angkanya benar, bedanya
 * dikatakan, dan pesan tanpa ukuran tidak dijawab apa-apa.
 */
import { describe, expect, it } from 'vitest';
import { sizeEquivalence } from './size-equivalence.js';

describe('sizeEquivalence', () => {
  it('mm dan inci sama → dikatakan sama', () => {
    expect(sizeEquivalence('pipa 114 mm itu 4 inci kan?', 'id')).toBe(
      'Ya — pipa 4 inci berdiameter luar 114 mm, jadi 114 mm memang ukuran itu.',
    );
  });

  it('mm dan inci tidak sama → diameter inci-nya disebut, ukuran HDPE-nya dijelaskan', () => {
    const text = sizeEquivalence('pipa 160 mm itu sama dengan 6 inch ya?', 'id')!;
    expect(text).toContain('pipa 6 inci berdiameter luar 165 mm, bukan 160 mm');
    expect(text).toContain('160 mm salah satu ukurannya');
  });

  it('hanya mm → padanan inci terdekat beserta diameternya', () => {
    expect(sizeEquivalence('pipa 90 mm itu berapa inci?', 'id')).toContain(
      'yang terdekat 3 inci, berdiameter luar 89 mm',
    );
  });

  it('hanya inci → diameter luarnya, pecahan ikut terbaca', () => {
    expect(sizeEquivalence('1/2 inci berapa mm?', 'id')).toBe(
      'Pipa 1/2 inci berdiameter luar 22 mm.',
    );
    expect(sizeEquivalence('1 1/4 inci berapa mm ya', 'id')).toBe(
      'Pipa 1 1/4 inci berdiameter luar 42 mm.',
    );
  });

  it('tanpa ukuran di pesan → tidak ada jawaban kesetaraan', () => {
    expect(sizeEquivalence('ukuran pipa apa aja?', 'id')).toBeNull();
    expect(sizeEquivalence('pipa 20 inci ada?', 'id')).toBeNull();
  });

  it('bahasa Inggris memakai angka yang sama', () => {
    expect(sizeEquivalence('is 160 mm the same as 6 inch?', 'en')).toContain(
      '6 inch pipe has an outside diameter of 165 mm, not 160 mm',
    );
  });
});
