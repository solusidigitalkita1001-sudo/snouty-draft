/**
 * Tes FAQ 2026-10-12 (MA-06/07): "Yang sudah saya catat: jumlah sambungan 50 sambungan."
 * Satuan yang sudah menyebut labelnya tidak diulang.
 */
import { describe, expect, it } from 'vitest';
import { capturedPhrase } from './technical.js';

describe('capturedPhrase', () => {
  it('satuan sama dengan label → nilai saja', () => {
    expect(capturedPhrase('Jumlah sambungan', '50 sambungan')).toBe('50 sambungan');
  });
  it('satuan lain → label + nilai', () => {
    expect(capturedPhrase('Jarak', '150 m')).toBe('jarak 150 m');
    expect(capturedPhrase('Jenis tanah', 'lempung')).toBe('jenis tanah lempung');
  });
});
