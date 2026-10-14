import { describe, expect, it } from 'vitest';
import { maskValues } from './value-mask.js';

describe('maskValues — angka dan ukuran disamarkan, kata-katanya tetap', () => {
  it.each([
    ['tebal pipa d 4 inch berapa?', 'tebal pipa d N berapa?'],
    ['harga pipa aw 1/2 inch berapa?', 'harga pipa aw N berapa?'],
    ['pipa aw 1 1/4 tebalnya berapa?', 'pipa aw N tebalnya berapa?'],
    ['hdpe 110 mm sdr 17', 'hdpe N sdr N'],
    ['Pipa VP 2" per meter', 'pipa vp N per meter'],
  ])('%s → %s', (input, expected) => {
    expect(maskValues(input)).toBe(expected);
  });
});
