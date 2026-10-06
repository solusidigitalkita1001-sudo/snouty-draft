/**
 * Pengetahuan teknik umum: deteksi dari teks bebas, dan invarian bahwa tidak satu angka,
 * standar, atau merek lain pun ada di dalamnya — yang berangka hanya boleh datang dari katalog.
 */
import { describe, expect, it } from 'vitest';
import { CONCEPTS, MATERIALS, explain, materialsIn } from './pipe-knowledge.js';

describe('pipe knowledge', () => {
  it('tidak satu pun entri memuat angka, nomor standar, atau merek lain', () => {
    const texts = [
      ...MATERIALS.flatMap((m) => [m.form, m.joining, m.durability, m.typicalUse]),
      ...CONCEPTS.map((c) => c.text),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/\bSNI\b|\bISO\b/);
      expect(text).not.toMatch(/rucika|wavin|maspion|vinilon/i);
    }
  });

  it('"apa bedanya pvc sama hdpe" → perbandingan per dimensi, sifatnya tidak tertukar', () => {
    const out = explain('apa bedanya pvc sama hdpe?', null);
    expect(out).toMatch(/^Perbedaan utama PVC \(uPVC\) dan HDPE:/);
    expect(out).toContain('- Bentuk: PVC (uPVC) kaku');
    expect(out).toContain('HDPE lentur');
    expect(out).toContain('- Sambungan:');
    expect(out).toContain('- Pemakaian lazim:');
  });

  it('satu bahan → ikhtisar; konsep yang disinggung ikut; tanpa bahan → kosong', () => {
    expect(explain('apa itu ppr?', null)).toMatch(/^PPR: kaku/);
    expect(explain('pipa yang ditanam di tanah enaknya apa?', 'hdpe')).toContain('Pipa tanam');
    expect(explain('apa itu fitting?', null)).toBe('');
  });

  it('kueri model ikut dicari; PE100 dikenali HDPE; galvanis dikenali', () => {
    expect(materialsIn('yang itu bedanya?', 'PE100 dan PPR').map((m) => m.family)).toEqual([
      'HDPE',
      'PPR',
    ]);
    expect(materialsIn('pipa besi vs pvc', null).map((m) => m.family)).toEqual(['PVC', 'Galvanis']);
  });
});
