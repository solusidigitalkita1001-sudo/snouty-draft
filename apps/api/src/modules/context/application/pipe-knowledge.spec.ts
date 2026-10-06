/**
 * Pengetahuan teknik umum: deteksi dari teks bebas, dan invarian bahwa tidak satu angka,
 * standar, atau merek lain pun ada di dalamnya — yang berangka hanya boleh datang dari katalog.
 */
import { describe, expect, it } from 'vitest';
import { CONCEPTS, MATERIALS, explain, materialsIn } from './pipe-knowledge.js';

describe('pipe knowledge', () => {
  it('tidak satu pun entri memuat angka, nomor standar, atau merek lain', () => {
    const texts = [
      ...MATERIALS.flatMap((m) => [
        m.gist,
        m.bestFor,
        m.form,
        m.joining,
        m.durability,
        m.typicalUse,
      ]),
      ...CONCEPTS.map((c) => c.text),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/\bSNI\b|\bISO\b/);
      expect(text).not.toMatch(/rucika|wavin|maspion|vinilon/i);
    }
  });

  it('"apa bedanya pvc sama hdpe" → ringkasan, blok per bahan, simpulan; sifatnya tidak tertukar', () => {
    const out = explain('apa bedanya pvc sama hdpe?', null);
    expect(out).toMatch(
      /^Singkatnya, \*\*PVC \(uPVC\) kaku dan dipasok batangan\*\*, sedangkan \*\*HDPE lentur/,
    );
    expect(out).toContain('**PVC (uPVC)**\n- Bentuk: kaku dan ringan');
    expect(out).toContain('**HDPE**\n- Bentuk: lentur dan ulet');
    expect(out).toContain('- Sambungan:');
    expect(out).toContain('- Pemakaian lazim:');
    expect(out).toMatch(/Jadi untuk \*\*instalasi tetap[^\n]*HDPE biasanya lebih cocok\.$/);
  });

  it('satu bahan → ikhtisar; konsep yang disinggung ikut; tanpa bahan → kosong', () => {
    expect(explain('apa itu ppr?', null)).toMatch(
      /^\*\*PPR\*\* — kaku dan tahan air panas\.\n- Bentuk:/,
    );
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
