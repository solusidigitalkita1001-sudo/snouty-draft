/**
 * P31-88 — nomor standar yang disebut jawaban harus bisa dipertanggungjawabkan.
 *
 * Yang dipaku: nomor dikenali dalam bentuk apa pun yang lazim ditulis, nomor pokok yang dikenal
 * menerima bagian dan tahunnya, nomor pokok yang tidak dikenal tidak pernah lolos, dan kata
 * biasa berangka ("PN 16", "kelas 10") tidak terbaca sebagai kutipan standar.
 */
import { describe, expect, it } from 'vitest';
import {
  isKnownStandard,
  normalizeStandard,
  standardCitationsIn,
  unknownStandardIn,
} from './standard-citations.js';

const KNOWN = new Set(['SNI 4829', 'SNI 06-0084-2002', 'ISO 4427', 'JIS K 6741', 'UPC 702.1']);

describe('kutipan nomor standar', () => {
  it('ditemukan dalam bentuk yang lazim ditulis', () => {
    expect(standardCitationsIn('mengacu SNI 4829-1:2015 dan ISO 4427')).toEqual([
      'SNI 4829-1:2015',
      'ISO 4427',
    ]);
    expect(standardCitationsIn('tabelnya di UPC Tabel 702.1')).toEqual(['UPC 702.1']);
    expect(standardCitationsIn('pipa JIS K 6741')).toEqual(['JIS K 6741']);
  });

  it('angka yang bukan nomor standar tidak ikut terbaca', () => {
    expect(standardCitationsIn('pipa PN 16 kelas 10, SDR 11, diameter 110 mm')).toEqual([]);
  });

  it('bentuk bakunya membuang tanda baca dan kata "tabel"', () => {
    expect(normalizeStandard('UPC Tabel 702.1:')).toBe('UPC 702.1');
    expect(normalizeStandard('sni-4829')).toBe('SNI 4829');
  });
});

describe('daftar nomor yang dipegang', () => {
  it('nomor pokok yang dikenal menerima bagian dan tahunnya', () => {
    expect(isKnownStandard('SNI 4829', KNOWN)).toBe(true);
    expect(isKnownStandard('SNI 4829-1:2015', KNOWN)).toBe(true);
    expect(isKnownStandard('SNI 4829:2015', KNOWN)).toBe(true);
  });

  it('nomor pokok yang tidak dikenal tidak pernah lolos', () => {
    expect(isKnownStandard('SNI 03-6481-2000', KNOWN)).toBe(false);
    // Mirip bukan sama: angka berikutnya bukan bagian dari dokumen yang dikenal.
    expect(isKnownStandard('SNI 48291', KNOWN)).toBe(false);
  });

  it('teks dengan satu nomor karangan menyebut nomor itu', () => {
    const text = 'Ukurannya mengikuti SNI 4829, sedangkan ventilasinya SNI 03-7065-2005.';
    expect(unknownStandardIn(text, KNOWN)).toBe('SNI 03-7065-2005');
  });

  it('teks yang seluruh nomornya dikenal tidak menyisakan apa pun', () => {
    expect(unknownStandardIn('ISO 4427 dan SNI 06-0084-2002', KNOWN)).toBeNull();
  });

  it('daftar kosong menolak setiap nomor — tanpa daftar tidak ada yang terbukti', () => {
    expect(unknownStandardIn('mengacu ISO 4427', new Set())).toBe('ISO 4427');
  });
});
