/** P17-10: ringkasan maksimal dua kalimat; desimal berkoma dan ukuran inci tidak memotong kalimat. */
import { describe, expect, it } from 'vitest';
import { firstSentences } from './summary-length.js';

describe('firstSentences', () => {
  it('memotong setelah kalimat kedua', () => {
    expect(
      firstSentences(
        'Pipa utama 1". Toren perlu dibantu pompa. Ada 8 produk Pralon. Pembuangan 4".',
      ),
    ).toBe('Pipa utama 1". Toren perlu dibantu pompa.');
  });

  it('desimal berkoma dan singkatan ukuran tidak dianggap akhir kalimat', () => {
    const text = 'Air mengalir 1,49 m/s di pipa 1". Sisa tekanan 0,02 bar, jadi perlu pompa.';
    expect(firstSentences(text)).toBe(text);
  });

  it('teks pendek tidak berubah', () => {
    expect(firstSentences('Satu kalimat saja.')).toBe('Satu kalimat saja.');
  });
});
