/**
 * Pengetahuan teknik umum: deteksi dari teks bebas, dan invarian bahwa tidak satu angka,
 * standar, atau merek lain pun ada di dalamnya — yang berangka hanya boleh datang dari katalog.
 */
import { describe, expect, it } from 'vitest';
import {
  CONCEPTS,
  MATERIALS,
  adviseMaterials,
  briefComparison,
  conceptsIn,
  explain,
  materialsIn,
} from './pipe-knowledge.js';
import { keepsStructure } from './product-question-pipeline.js';

describe('pipe knowledge', () => {
  it('tidak satu pun entri memuat angka, nomor standar, atau merek lain', () => {
    const texts = [
      ...MATERIALS.flatMap((m) => [
        m.gist,
        m.bestFor,
        m.notFor,
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

  it('"apa bedanya fitting sama hdpe" → bahan vs komponen dulu, lalu ikhtisar HDPE dan konsep fitting; EN setara', () => {
    const id = explain('apa bedanya fitting sama hdpe?', 'HDPE');
    expect(id).toMatch(
      /^\*\*HDPE\*\* adalah bahan pipa, sedangkan \*\*fitting\*\* adalah komponen penyambungnya/,
    );
    expect(id).toContain('**HDPE** itu lentur dan bisa digulung');
    expect(id).toContain('Fitting adalah komponen penyambung pipa');
    const en = explain('what is the difference between a fitting and hdpe?', 'HDPE', 'en');
    expect(en).toMatch(
      /^\*\*HDPE\*\* is a pipe material, while a \*\*fitting\*\* is a connecting part/,
    );
    expect(en).toContain('Fittings are the connecting parts of a pipe run');
    // Tanpa kata pembanding, kalimat "bukan dua pilihan" tidak dipaksakan.
    expect(explain('fitting hdpe apa saja?', 'HDPE')).not.toContain('bukan dua pilihan');
  });

  it('satu bahan → ikhtisar; konsep yang disinggung ikut; tanpa bahan → kosong', () => {
    const ppr = explain('apa itu ppr?', null);
    expect(ppr).toMatch(/^\*\*PPR\*\* itu kaku dan tahan air panas: /); // prosa, bukan butir
    expect(ppr).toContain('**cocok untuk instalasi air panas dan dingin di dalam bangunan**');
    expect(ppr).toContain('kurang cocok untuk');
    expect(ppr).not.toContain('- Bentuk:');
    expect(explain('pipa yang ditanam di tanah enaknya apa?', 'hdpe')).toContain('Pipa tanam');
    // "Apa itu fitting?" kini punya jawaban konsep (P16-04); yang tak dikenal tetap kosong.
    expect(explain('apa itu fitting?', null)).toContain('Fitting adalah komponen penyambung pipa');
    expect(explain('apa itu kompresor?', null)).toBe('');
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

  it('locale: Indonesia tidak berubah; Inggris berstruktur sama (jumlah butir dan label tebal)', () => {
    const q = 'apa bedanya pvc sama hdpe?';
    expect(explain(q, null, 'id')).toBe(explain(q, null));
    expect(explain(q, null)).toMatch(/^Singkatnya, \*\*PVC \(uPVC\) kaku dan dipasok batangan\*\*/);

    const id = explain(q, null);
    const en = explain('what is the difference between pvc and hdpe?', null, 'en');
    const bullets = (t: string) => t.split('\n').filter((l) => l.startsWith('- ')).length;
    const bolds = (t: string) => (t.match(/\*\*/g) ?? []).length;
    expect(en).toMatch(/^In short, \*\*PVC \(uPVC\) is rigid/);
    expect(en).toContain('- Joining:');
    expect(en).not.toMatch(/\b(dan|sambungan|bentuk)\b/i);
    expect(bullets(en)).toBe(bullets(id));
    expect(bolds(en)).toBe(bolds(id));
  });

  it('locale en: satu bahan, konsep, ringkasan, dan saran; kata kunci Inggris dikenali', () => {
    expect(materialsIn('is buried steel pipe ok?', null).map((m) => m.family)).toEqual([
      'Galvanis',
    ]);
    expect(conceptsIn('is buried pipe ok?').map((c) => c.topic)).toEqual(['pipa tanam']);
    expect(explain('tell me about ppr', null, 'en')).toMatch(/^\*\*PPR\*\* is rigid/);
    expect(explain('buried pipe', null, 'en')).toMatch(/^Buried pipe carries/);
    const [pvc, hdpe] = MATERIALS;
    expect(briefComparison([pvc!, hdpe!], 'en')).toBe(
      'As above: **PVC (uPVC) is rigid and supplied in straight lengths**, while **HDPE is flexible and can be coiled**.',
    );
    const advice = adviseMaterials(
      [pvc!, hdpe!],
      {
        buildingLabel: 'house',
        floors: 2,
        needsMoreData: true,
      },
      'en',
    );
    expect(advice.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(2);
    expect(advice).toMatch(/^For a house with 2 floors, the choice of material/);
    expect(advice).toContain('I need a few things');
  });
});
