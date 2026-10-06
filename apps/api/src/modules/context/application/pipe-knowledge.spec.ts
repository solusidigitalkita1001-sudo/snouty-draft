/**
 * Pengetahuan teknik umum: deteksi dari teks bebas, dan invarian bahwa tidak satu angka,
 * standar, atau merek lain pun ada di dalamnya — yang berangka hanya boleh datang dari katalog.
 */
import { describe, expect, it } from 'vitest';
import { CONCEPTS, MATERIALS, adviseMaterials, explain, materialsIn } from './pipe-knowledge.js';
import { keepsStructure } from './product-question-pipeline.js';

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

  it('adviseMaterials: tidak memilih satu bahan sebagai yang terbaik; menyebut apa yang menentukan', () => {
    const both = materialsIn('pvc atau hdpe', null);
    const out = adviseMaterials(both, {
      buildingLabel: 'rumah tinggal',
      floors: 2,
      needsMoreData: true,
    });
    expect(out).toMatch(
      /^Untuk rumah tinggal 2 lantai, pilihan bahan \*\*tidak ditentukan dari jumlah lantai saja\*\*/,
    );
    expect(out).toContain('- **PVC (uPVC)** biasanya lebih cocok untuk');
    expect(out).toContain('- **HDPE** biasanya lebih cocok untuk');
    expect(out).not.toMatch(/\d(?!\slantai)/); // satu-satunya angka: jumlah lantai dari state
    expect(out).toContain('saya perlu beberapa hal di bawah ini');

    const complete = adviseMaterials(both, {
      buildingLabel: null,
      floors: null,
      needsMoreData: false,
    });
    expect(complete).toMatch(
      /^Untuk kasus ini, pilihan bahan \*\*tidak bisa ditentukan dari satu hal saja\*\*/,
    );
    expect(complete).not.toContain('saya perlu');
  });

  it('keepsStructure: tanpa butir di DATA selalu lolos; dengan butir butuh butir + tebal', () => {
    const knowledge = explain('apa bedanya pvc sama hdpe?', null); // 8 butir
    expect(keepsStructure('satu paragraf saja', '')).toBe(true);
    expect(keepsStructure('Secara umum **PVC** kaku dan HDPE lentur.', knowledge)).toBe(false);
    const half = '**PVC**\n- a\n- b\n\n**HDPE**\n- c\n- d';
    expect(keepsStructure(half, knowledge)).toBe(true);
    expect(keepsStructure(half.replaceAll('**', ''), knowledge)).toBe(false);
  });

  it('kueri model ikut dicari; PE100 dikenali HDPE; galvanis dikenali', () => {
    expect(materialsIn('yang itu bedanya?', 'PE100 dan PPR').map((m) => m.family)).toEqual([
      'HDPE',
      'PPR',
    ]);
    expect(materialsIn('pipa besi vs pvc', null).map((m) => m.family)).toEqual(['PVC', 'Galvanis']);
  });
});
