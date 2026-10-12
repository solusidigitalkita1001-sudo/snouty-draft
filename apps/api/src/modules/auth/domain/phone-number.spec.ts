import { describe, expect, it } from 'vitest';
import { normalizeIndonesianMobile } from './phone-number.js';

describe('nomor HP yang bisa dihubungi (2026-10-12)', () => {
  it('08…, 628…, +628… dengan spasi/tanda hubung → satu bentuk +628…', () => {
    expect(normalizeIndonesianMobile('0812-3456-7890')).toBe('+6281234567890');
    expect(normalizeIndonesianMobile('62 812 3456 789')).toBe('+628123456789');
    expect(normalizeIndonesianMobile('+62 (812) 3456.7890')).toBe('+6281234567890');
  });

  it('bukan nomor seluler Indonesia → ditolak', () => {
    expect(normalizeIndonesianMobile('021-555-1234')).toBeNull(); // telepon rumah
    expect(normalizeIndonesianMobile('0812')).toBeNull(); // terlalu pendek
    expect(normalizeIndonesianMobile('0812345678901234')).toBeNull(); // terlalu panjang
    expect(normalizeIndonesianMobile('+1 415 555 0100')).toBeNull();
    expect(normalizeIndonesianMobile('nomor saya')).toBeNull();
  });
});
