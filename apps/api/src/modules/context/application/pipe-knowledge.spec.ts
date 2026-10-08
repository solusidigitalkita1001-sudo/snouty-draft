/**
 * Pengetahuan teknik umum: perakitan jawaban dari keluarga produk + topik yang dikenali pemahaman
 * (P16-11: bukan dari pola kalimat), dan invarian bahwa tidak satu angka, standar, atau merek lain
 * pun ada di dalamnya — yang berangka hanya boleh datang dari katalog.
 */
import { describe, expect, it } from 'vitest';
import { TEST_LEXICON } from '../../understanding/testing/understood.js';
import {
  CONCEPTS,
  MATERIALS,
  adviseMaterials,
  briefComparison,
  conceptsFor,
  explain,
  materialsFor,
  reformat,
  type ExplainInput,
} from './pipe-knowledge.js';
import { keepsStructure } from './product-question-pipeline.js';

/** Masukan `explain` seperti yang dihasilkan pemahaman: keluarga dari kosakata, topik dari label. */
const q = (
  text: string,
  topics: readonly string[] = [],
  over: Partial<ExplainInput> = {},
): ExplainInput => ({
  families: TEST_LEXICON.productFamilies(text),
  topics,
  comparison: false,
  aboutMaterial: false,
  ...over,
});
const concept = { aboutMaterial: true } as const;
const comparison = { comparison: true, aboutMaterial: true } as const;

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
      // Nama keluarga standar (SNI, JIS) boleh disebut sebagai kelas produk; NOMOR standar tidak —
      // nomor hanya dari katalog/spesifikasi resmi (OQ-54).
      expect(text).not.toMatch(/\b(?:SNI|ISO|JIS)\s*[-\s]?\d/);
      expect(text).not.toMatch(/rucika|wavin|maspion|vinilon/i);
    }
  });

  it('"apa bedanya pvc sama hdpe" → ringkasan, blok per bahan, simpulan; sifatnya tidak tertukar', () => {
    const out = explain(q('apa bedanya pvc sama hdpe?', [], comparison));
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
    const id = explain(q('apa bedanya fitting sama hdpe?', ['fitting'], comparison));
    expect(id).toMatch(
      /^\*\*HDPE\*\* adalah bahan pipa, sedangkan \*\*fitting\*\* adalah komponen penyambungnya/,
    );
    expect(id).toContain('**HDPE** lentur dan ulet');
    expect(id).toContain('Fitting adalah komponen penyambung pipa');
    const en = explain(
      q('what is the difference between a fitting and hdpe?', ['fitting'], comparison),
      'en',
    );
    expect(en).toMatch(
      /^\*\*HDPE\*\* is a pipe material, while a \*\*fitting\*\* is a connecting part/,
    );
    expect(en).toContain('Fittings are the connecting parts of a pipe run');
    // Tanpa perbandingan, kalimat "bukan dua pilihan" tidak dipaksakan.
    expect(explain(q('fitting hdpe apa saja?', ['fitting']))).not.toContain('bukan dua pilihan');
  });

  it('reformat: tabel dua bahan, tabel fitting vs bahan, butir, ringkasan — isi sama, tanpa "|" liar; EN setara', () => {
    const pvcHdpe = materialsFor(['pvc', 'hdpe']);
    const table = reformat('table', { materials: pvcHdpe, fitting: false }, 'id')!;
    expect(table.split('\n')[0]).toBe('| Aspek | **PVC (uPVC)** | **HDPE** |');
    expect(table).toContain('| Sambungan |');
    expect(table.split('\n').every((line) => line.startsWith('|') && line.endsWith('|'))).toBe(
      true,
    );
    // Subjek menentukan bahannya: satu bahan + fitting → tabel bahan vs komponen.
    const hdpe = materialsFor(['hdpe']);
    const fittingTable = reformat('table', { materials: hdpe, fitting: true }, 'id')!;
    expect(fittingTable).toContain('| Aspek | **HDPE** | **Fitting** |');
    expect(reformat('table', { materials: hdpe, fitting: true }, 'en')).toContain(
      '| Aspect | **HDPE** | **Fitting** |',
    );
    expect(reformat('bullets', { materials: pvcHdpe, fitting: false })).toContain(
      '**PVC (uPVC)**\n- Bentuk:',
    );
    expect(reformat('summary', { materials: pvcHdpe, fitting: false })).toContain('Singkatnya');
    expect(reformat('table', { materials: [], fitting: false })).toBeNull();
  });

  it('materi internal Pralon (OQ-54): cara sambung lem, rubber ring, penyimpanan, gangguan, istilah, uPVC — terjawab tanpa bahan di pesan, dua bahasa', () => {
    expect(explain(q('cara nyambung pipa pvc pakai lem gimana?', ['sambungan lem']))).toContain(
      'menyambung pipa PVC ujung TS End dengan lem',
    );
    expect(explain(q('pelumas rubber ring boleh pakai oli?', ['sambungan rubber ring']))).toContain(
      'Jangan memakai oli, gemuk, minyak, atau sabun',
    );
    // Pertanyaan topik dibuka dengan topiknya, bukan ikhtisar bahan; "apa itu pvc" tetap bahan dulu.
    expect(explain(q('pipa pvc disimpan di luar boleh?', ['penyimpanan']))).toMatch(
      /^Pipa PVC sebaiknya disimpan begini:/,
    );
    expect(explain(q('apa itu pvc?', [], concept))).toMatch(/^\*\*PVC/);
    expect(explain(q('pipa bocor di sambungan kenapa ya?', ['perawatan dan gangguan']))).toContain(
      'Bocor di sambungan',
    );
    expect(explain(q('SDR itu apa?', ['istilah dimensi']))).toContain(
      '**SDR** — perbandingan diameter luar terhadap tebal dinding',
    );
    expect(explain(q('upvc itu apa?', ['upvc']))).toContain('uPVC adalah unplasticized PVC');
    // Kelas PVC ikut dari keluarga produknya ("pvc aw"), tanpa topik eksplisit.
    expect(explain(q('bedanya pralon aw sama pippo aw?', [], comparison))).toContain(
      'PIPPO adalah merek kedua Pralon',
    );
    expect(explain(q('how do I join pvc pipe with glue?', ['sambungan lem']), 'en')).toContain(
      'with solvent cement',
    );
    expect(explain(q('how should I store pvc pipe?', ['penyimpanan']), 'en')).toContain(
      'prolonged direct sun',
    );
  });

  it('"pipa buat air panas pake apa?" → konsep air panas: PPR, bukan PVC; tanpa bahan di pesan pun terjawab', () => {
    const out = explain(q('pipa buat air panas pake apa?', ['air panas']));
    expect(out).toContain('**PPR**');
    expect(out).toContain('PVC tidak untuk air panas');
    expect(explain(q('what pipe for hot water?', ['air panas']), 'en')).toContain('**PPR**');
  });

  it('satu bahan → ikhtisar; konsep yang disinggung ikut; tanpa bahan → kosong', () => {
    const ppr = explain(q('apa itu ppr?', [], concept));
    expect(ppr).toMatch(/^\*\*PPR\*\* kaku, dipasok batangan/); // prosa, bukan butir
    expect(ppr).toContain('**cocok untuk instalasi air panas dan dingin di dalam bangunan**');
    expect(ppr).toContain('kurang cocok untuk');
    expect(ppr).not.toContain('- Bentuk:');
    expect(explain(q('pipa yang ditanam di tanah enaknya apa? hdpe', ['pipa tanam']))).toContain(
      'Pipa tanam',
    );
    // "Apa itu fitting?" kini punya jawaban konsep (P16-04); yang tak dikenal tetap kosong.
    expect(explain(q('apa itu fitting?', ['fitting']))).toContain(
      'Fitting adalah komponen penyambung pipa',
    );
    expect(explain(q('apa itu kompresor?'))).toBe('');
  });

  it('adviseMaterials: tidak memilih satu bahan sebagai yang terbaik; menyebut apa yang menentukan', () => {
    const both = materialsFor(TEST_LEXICON.productFamilies('pvc atau hdpe'));
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
    const knowledge = explain(q('apa bedanya pvc sama hdpe?', [], comparison)); // 8 butir
    expect(keepsStructure('satu paragraf saja', '')).toBe(true);
    expect(keepsStructure('Secara umum **PVC** kaku dan HDPE lentur.', knowledge)).toBe(false);
    const half = '**PVC**\n- a\n- b\n\n**HDPE**\n- c\n- d';
    expect(keepsStructure(half, knowledge)).toBe(true);
    expect(keepsStructure(half.replaceAll('**', ''), knowledge)).toBe(false);
  });

  it('keluarga kanonis dipetakan ke bahannya: PE100 → HDPE, galvanis/besi dikenali, kelas PVC = PVC', () => {
    expect(
      materialsFor(TEST_LEXICON.productFamilies('PE100 dan PPR')).map((m) => m.family),
    ).toEqual(['HDPE', 'PPR']);
    expect(
      materialsFor(TEST_LEXICON.productFamilies('pipa besi vs pvc')).map((m) => m.family),
    ).toEqual(['Galvanis', 'PVC']);
    // "pvc aw" dan "pvc d" adalah satu bahan (PVC), bukan dua.
    expect(materialsFor(['pvc d', 'pvc aw']).map((m) => m.family)).toEqual(['PVC']);
    expect(materialsFor([])).toEqual([]);
    // Konsep terikat keluarga: kelas PVC ikut dari "pvc aw", tanpa topik.
    expect(conceptsFor([], ['pvc aw']).map((c) => c.topic)).toEqual(['kelas pvc']);
    expect(conceptsFor(['pipa tanam']).map((c) => c.topic)).toEqual(['pipa tanam']);
  });

  it('locale: Indonesia tidak berubah; Inggris berstruktur sama (jumlah butir dan label tebal)', () => {
    const input = q('apa bedanya pvc sama hdpe?', [], comparison);
    expect(explain(input, 'id')).toBe(explain(input));
    expect(explain(input)).toMatch(/^Singkatnya, \*\*PVC \(uPVC\) kaku dan dipasok batangan\*\*/);

    const id = explain(input);
    const en = explain(q('what is the difference between pvc and hdpe?', [], comparison), 'en');
    const bullets = (t: string) => t.split('\n').filter((l) => l.startsWith('- ')).length;
    const bolds = (t: string) => (t.match(/\*\*/g) ?? []).length;
    expect(en).toMatch(/^In short, \*\*PVC \(uPVC\) is rigid/);
    expect(en).toContain('- Joining:');
    expect(en).not.toMatch(/\b(dan|sambungan|bentuk)\b/i);
    expect(bullets(en)).toBe(bullets(id));
    expect(bolds(en)).toBe(bolds(id));
  });

  it('locale en: satu bahan, konsep, ringkasan, dan saran; nama Inggris dikenali kosakata', () => {
    expect(
      materialsFor(TEST_LEXICON.productFamilies('is buried steel pipe ok?')).map((m) => m.family),
    ).toEqual(['Galvanis']);
    expect(explain(q('tell me about ppr', [], concept), 'en')).toMatch(/^\*\*PPR\*\* is rigid/);
    expect(explain(q('buried pipe', ['pipa tanam']), 'en')).toMatch(/^Buried pipe carries/);
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
