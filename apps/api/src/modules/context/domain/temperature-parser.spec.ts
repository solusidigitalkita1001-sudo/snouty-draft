import { describe, expect, it } from 'vitest';
import { parseTemperature } from './temperature-parser.js';

describe('parseTemperature', () => {
  it('suhu tersurat dalam °C, derajat, degrees', () => {
    expect(parseTemperature('Jalur air proses pabrik, suhu 70°C, panjang 200 meter')).toBe(70);
    expect(parseTemperature('pipa untuk air suhu 60 derajat')).toBe(60);
    expect(parseTemperature('process water at 70 degrees C, 200 m run')).toBe(70);
    expect(parseTemperature('suhu 30 derajat di luar')).toBe(30);
  });

  it('angka tanpa satuan suhu bukan suhu', () => {
    expect(parseTemperature('rumah 2 lantai, 30 meter')).toBeNull();
    expect(parseTemperature('pipa 63 mm')).toBeNull();
    expect(parseTemperature('jaraknya 150 m')).toBeNull();
  });
});
