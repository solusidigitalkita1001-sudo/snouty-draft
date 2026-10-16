/** Smoke 2026-10-16: "Kedalaman sumur 40 m" kehilangan labelnya karena "m" substring dari "kedalaman". */
import { describe, expect, it } from 'vitest';
import { capturedPhrase } from './technical.js';

describe('capturedPhrase', () => {
  it('label dipertahankan bila satuannya hanya substring; dibuang bila satuannya kata di label', () => {
    expect(capturedPhrase('Kedalaman sumur', '40 m')).toBe('kedalaman sumur 40 m');
    expect(capturedPhrase('Panjang kolam', '4 m')).toBe('panjang kolam 4 m');
    expect(capturedPhrase('Jumlah kolam', '10 kolam')).toBe('10 kolam');
    expect(capturedPhrase('Jumlah lantai', '8 lantai')).toBe('8 lantai');
    expect(capturedPhrase('Debit rencana', '5 l/s')).toBe('debit rencana 5 l/s');
  });
});
