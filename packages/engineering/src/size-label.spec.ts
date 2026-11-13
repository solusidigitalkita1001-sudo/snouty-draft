/**
 * Smoke test 13 Nov 2026, temuan 12: ukuran hanya dalam inci membuat pembeli menebak di toko,
 * karena pipa di rak bertanda milimeter.
 */
import { describe, expect, it } from 'vitest';
import { sizeWithMm } from './size-label.js';

describe('sizeWithMm', () => {
  it('label inci membawa diameter luarnya', () => {
    expect(sizeWithMm('1"')).toBe('1" (Ø32 mm)');
    expect(sizeWithMm('3/4"')).toBe('3/4" (Ø26 mm)');
    expect(sizeWithMm('1½"')).toBe('1½" (Ø48 mm)');
    expect(sizeWithMm('4"')).toBe('4" (Ø114 mm)');
  });

  it('label milimeter tidak diulang', () => {
    expect(sizeWithMm('110 mm')).toBe('110 mm');
    expect(sizeWithMm('25 mm')).toBe('25 mm');
  });

  it('ukuran yang tidak ada di tabel tampil apa adanya, tanpa milimeter karangan', () => {
    expect(sizeWithMm('20"')).toBe('20"');
    expect(sizeWithMm('—')).toBe('—');
    expect(sizeWithMm('')).toBe('');
    expect(sizeWithMm(null)).toBe('');
  });
});
