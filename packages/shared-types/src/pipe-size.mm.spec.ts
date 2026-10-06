/**
 * Ukuran milimeter (docs/PIPE_SIZE_MM_EXTENSION.md §7). Perilaku inci lama diuji di
 * `pipe-size.spec.ts` tanpa perubahan; berkas ini hanya menambah satuan mm dan pecahan ambigu.
 */
import { describe, expect, it } from 'vitest';
import { PipeSize, comparePipeSize, parsePipeSize, samePipeSize } from './pipe-size.js';

describe('parsePipeSize — milimeter', () => {
  it('"110 mm", "110mm", "110 MM" → { mm, 110000, "110 mm" }', () => {
    for (const raw of ['110 mm', '110mm', '110 MM', ' 110 mm ']) {
      expect(parsePipeSize(raw)).toMatchObject({ unit: 'mm', valueX1000: 110000, label: '110 mm' });
    }
  });

  it('"12,5 mm" dan "12.5 mm" → { mm, 12500, "12.5 mm" }; nol di belakang dibuang', () => {
    expect(parsePipeSize('12,5 mm')).toMatchObject({
      unit: 'mm',
      valueX1000: 12500,
      label: '12.5 mm',
    });
    expect(parsePipeSize('12.50 mm')?.label).toBe('12.5 mm');
    expect(parsePipeSize('63.000 mm')?.label).toBe('63 mm');
  });

  it('di luar rentang (0 mm, 4500 mm) → null', () => {
    expect(parsePipeSize('0 mm')).toBeNull();
    expect(parsePipeSize('4500 mm')).toBeNull();
    expect(parsePipeSize('3150 mm')).not.toBeNull();
    expect(PipeSize.mm(-1)).toBeNull();
  });

  it('tanpa satuan tetap inci (kompatibel ke belakang): "1 1/4"" → { in, 1250, "1¼"" }', () => {
    expect(parsePipeSize('1 1/4"')).toMatchObject({ unit: 'in', valueX1000: 1250, label: '1¼"' });
    expect(parsePipeSize('110')).toBeNull(); // 110" di luar batas — bukan diam-diam dibaca mm
  });
});

describe('parsePipeSize — pecahan ambigu', () => {
  it('"11/2"" (pembilang ≥ penyebut) → null, bukan 5,5"', () => {
    expect(parsePipeSize('11/2"')).toBeNull();
    expect(parsePipeSize('11/2')).toBeNull();
    expect(parsePipeSize('3/2')).toBeNull();
    expect(parsePipeSize('1 3/2')).toBeNull();
    expect(parsePipeSize('1 1/2')?.label).toBe('1½"');
  });
});

describe('perbandingan antar satuan', () => {
  const mm63 = parsePipeSize('63 mm')!;
  const in2 = parsePipeSize('2"')!;

  it('samePipeSize(63 mm, 2") = false; satuan sama + nilai sama = true', () => {
    expect(samePipeSize(mm63, in2)).toBe(false);
    expect(samePipeSize(mm63, parsePipeSize('63mm')!)).toBe(true);
    expect(mm63.equals(in2)).toBe(false);
  });

  it('comparePipeSize antar satuan berbeda → throw; satuan sama → selisih', () => {
    expect(() => comparePipeSize(mm63, in2)).toThrow(/satuan berbeda/);
    expect(comparePipeSize(parsePipeSize('110 mm')!, mm63)).toBeGreaterThan(0);
    expect(() => mm63.isLargerThan(in2)).toThrow();
  });

  it('sort: inci dulu lalu mm, masing-masing menaik', () => {
    const sorted = PipeSize.sort(
      ['110 mm', '2"', '63 mm', '3/4"'].map((raw) => parsePipeSize(raw)!),
    ).map((s) => s.label);
    expect(sorted).toEqual(['3/4"', '2"', '63 mm', '110 mm']);
  });

  it('`.inches` hanya untuk inci; untuk mm melempar galat alih-alih mengonversi', () => {
    expect(in2.inches).toBe(2);
    expect(() => mm63.inches).toThrow(/tidak ada konversi/);
  });

  it('fromStored membentuk ulang dari kolom database dan menolak nilai di luar rentang', () => {
    expect(PipeSize.fromStored('mm', 110000)?.label).toBe('110 mm');
    expect(PipeSize.fromStored('in', 750)?.label).toBe('3/4"');
    expect(PipeSize.fromStored('in', 100_001)).toBeNull();
    expect(JSON.stringify(PipeSize.fromStored('mm', 12500))).toBe('"12.5 mm"');
  });
});
