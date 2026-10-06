/**
 * Primer bahan: deteksi keluarga dari teks bebas, dan invarian bahwa tidak ada satu angka pun
 * di dalamnya — angka hanya boleh datang dari katalog bersumber.
 */
import { describe, expect, it } from 'vitest';
import { MATERIAL_PRIMERS, primersFor } from './material-primer.js';

describe('material primer', () => {
  it('tidak satu pun primer memuat angka atau merek lain', () => {
    for (const primer of MATERIAL_PRIMERS) {
      expect(primer.text).not.toMatch(/\d/);
      expect(primer.text).not.toMatch(/rucika|wavin|maspion|vinilon/i);
    }
  });

  it('"apa bedanya pvc dan hdpe" → dua primer, urutan daftar', () => {
    const [pvc, hdpe, ...rest] = primersFor('apa bedanya pvc dan hdpe?', null);
    expect(pvc).toContain('PVC (uPVC)');
    expect(hdpe).toContain('HDPE');
    expect(rest).toEqual([]);
  });

  it('kueri model ikut dicari; "PE100" dikenali HDPE; tanpa bahan → kosong', () => {
    expect(primersFor('yang itu bedanya?', 'PE100 dan PPR')).toHaveLength(2);
    expect(primersFor('ada ukuran 3/4?', 'pvc aw')).toHaveLength(1);
    expect(primersFor('apa itu fitting?', null)).toEqual([]);
  });
});
