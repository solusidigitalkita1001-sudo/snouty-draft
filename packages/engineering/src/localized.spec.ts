/** P17-10: penjelasan aturan berbahasa Indonesia memakai koma desimal; kode rujukan utuh. */
import { describe, expect, it } from 'vitest';
import { indonesianDecimals, localized } from './rule.js';

describe('indonesianDecimals', () => {
  it('angka desimal memakai koma', () => {
    expect(indonesianDecimals('Tinggi antar lantai diasumsikan 3.5 meter.')).toBe(
      'Tinggi antar lantai diasumsikan 3,5 meter.',
    );
    expect(indonesianDecimals('debit puncaknya 1.03 l/s (16.3 gpm)')).toBe(
      'debit puncaknya 1,03 l/s (16,3 gpm)',
    );
  });

  it('nomor pasal dan kode rujukan tidak diubah', () => {
    expect(indonesianDecimals('IPC E103.3(2) kolom public')).toBe('IPC E103.3(2) kolom public');
    expect(indonesianDecimals('pipa tegak 2 lantai → 2½" (IPC 710.1(2))')).toBe(
      'pipa tegak 2 lantai → 2½" (IPC 710.1(2))',
    );
  });

  it('bilangan bulat dan ukuran pecahan tidak tersentuh', () => {
    expect(indonesianDecimals('4 cabang 3/4" dan 11 titik')).toBe('4 cabang 3/4" dan 11 titik');
  });

  it('teks Inggris tetap bertitik', () => {
    expect(localized('en', { id: '3.5 meter', en: '3.5 meters' })).toBe('3.5 meters');
    expect(localized('id', { id: '3.5 meter', en: '3.5 meters' })).toBe('3,5 meter');
  });
});
