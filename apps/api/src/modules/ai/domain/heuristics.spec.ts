/**
 * Jalur cepat tanpa model: hanya bentuk yang PASTI yang dipotong. Yang paling penting di sini
 * adalah kasus yang TIDAK boleh dipotong — pesan yang membawa kebutuhan tetap ke model
 * (lalu ke presedensi kebutuhan di `context`).
 */
import { describe, expect, it } from 'vitest';
import { certainIntent, heuristicProductQuestion } from './heuristics.js';

describe('certainIntent', () => {
  it('sapaan utuh, merek pesaing, konsep produk — pasti', () => {
    expect(certainIntent('hai')?.intent).toBe('OUT_OF_SCOPE');
    expect(certainIntent('Selamat pagi, Snouty!')?.intent).toBe('OUT_OF_SCOPE');
    expect(certainIntent('lebih bagus Pralon atau Rucika?')?.intent).toBe('COMPETITOR_QUESTION');
    expect(certainIntent('apa bedanya pvc sama hdpe?')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('apa itu PPR?')?.intent).toBe('PRODUCT_LOOKUP');
  });

  it('tidak pasti → null: kebutuhan, rekomendasi, pertanyaan ukuran, kalimat bebas', () => {
    expect(certainIntent('lebih bagus PVC atau HDPE buat rumah 2 lantai?')).toBeNull();
    expect(certainIntent('rumah 2 lantai 3 kamar mandi')).toBeNull();
    expect(certainIntent('ada ukuran 3/4 untuk PVC AW?')).toBeNull();
    expect(certainIntent('hai, saya mau bangun rumah 2 lantai')).toBeNull();
    expect(certainIntent('pipa')).toBeNull();
  });

  it('regex global tidak menyisakan lastIndex (pemanggilan berulang konsisten)', () => {
    expect(certainIntent('apa bedanya pvc dan hdpe')?.intent).toBe('PRODUCT_LOOKUP');
    expect(certainIntent('apa bedanya pvc dan hdpe')?.intent).toBe('PRODUCT_LOOKUP');
  });
});

describe('heuristicProductQuestion', () => {
  it('keluarga + aspek dari bentuk kalimat; ukuran untuk ketersediaan', () => {
    expect(heuristicProductQuestion('ada ukuran 3/4 inch untuk PVC AW?')).toEqual({
      productQuery: 'pvc aw',
      aspect: 'size_availability',
      size: '3/4',
    });
    expect(heuristicProductQuestion('standar SNI pipa PVC AW apa?')).toMatchObject({
      productQuery: 'pvc aw',
      aspect: 'standard',
    });
    expect(heuristicProductQuestion('apa bedanya pvc sama hdpe?')).toEqual({
      productQuery: 'pvc dan hdpe',
      aspect: null,
      size: null,
    });
  });

  it('tanpa keluarga produk → productQuery null (adapter live menyerahkannya ke model); aspek tetap terbaca', () => {
    expect(heuristicProductQuestion('pipa yang bagus buat air panas apa?')).toEqual({
      productQuery: null,
      aspect: null,
      size: null,
    });
    expect(heuristicProductQuestion('ada ukuran 3/4?')).toMatchObject({
      productQuery: null,
      aspect: 'size_availability',
      size: '3/4',
    });
  });
});
