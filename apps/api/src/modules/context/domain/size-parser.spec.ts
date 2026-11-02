import { describe, expect, it } from 'vitest';
import { PipeSize } from '@snouty/shared-types';
import { parseSize } from './size-parser.js';

describe('parseSize — ukuran pipa dari teks', () => {
  it('pecahan, pecahan campuran, dan milimeter — dalam bentuk yang diterima PipeSize', () => {
    expect(parseSize('pvc aw ada ukuran 3/4?')).toBe('3/4');
    expect(parseSize('ada ukuran 1 1/2 inch?')).toBe('1 1/2');
    expect(parseSize('elbow hdpe 63 mm ada?')).toBe('63 mm');
    expect(parseSize('do you have 3/4"?')).toBe('3/4');
    for (const text of ['3/4', '1 1/2', '63 mm']) expect(PipeSize.parse(text)).not.toBeNull();
  });

  it('angka kelas produk dan jumlah bangunan bukan ukuran (tinjauan 2026-10-08)', () => {
    expect(parseSize('hdpe pe 100 ada ukuran 63 mm?')).toBe('63 mm');
    expect(parseSize('pe100 ada ukuran 2 inch?')).toBe('2');
    expect(parseSize('pvc aw pn 10 ukuran 3/4 ada?')).toBe('3/4');
    expect(parseSize('rumah 2 lantai ada ukuran 3/4?')).toBe('3/4');
    expect(parseSize('sdr 11 ukuran 90 mm ada?')).toBe('90 mm');
  });

  it('angka telanjang hanya cadangan; tanpa angka → null', () => {
    expect(parseSize('ukuran 63 ada?')).toBe('63 mm');
    expect(parseSize('elbow hdpe 63 ada?')).toBe('63 mm');
    expect(parseSize('ukuran 4 ada?')).toBe('4');
    expect(parseSize('ada ukuran apa saja?')).toBeNull();
    expect(parseSize('pe 100 ada?')).toBeNull();
  });
});

/**
 * P32-34 — nomor lantai bukan ukuran. Produksi 2026-11-02: "tekanannya cukup ga buat shower lantai
 * 3?" dijawab "Ukuran 3" ada di beberapa jenis pipa: … Yang mana yang dimaksud?".
 */
describe('nomor lantai', () => {
  it('"lantai 3" bukan pipa 3 inci', () => {
    expect(parseSize('tekanannya cukup ga buat shower lantai 3?')).toBeNull();
    expect(parseSize('is the pressure enough for the shower on floor 3?')).toBeNull();
    expect(parseSize('kamar mandi lt 2 pakai pipa apa?')).toBeNull();
  });

  it('ukuran yang disebut di kalimat bernomor lantai tetap terbaca', () => {
    expect(parseSize('pipa 3/4 buat lantai 3 cukup?')).toBe('3/4');
    expect(parseSize('lantai 3 pakai pipa 1 1/2 inch')).toBe('1 1/2');
  });
});
