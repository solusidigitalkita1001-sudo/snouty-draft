/**
 * Jawaban pengetahuan dari DATA (daftar FAQ pemilik 2026-10-09): fakta bersumber per topik + data
 * katalog yang dihitung saat itu. Angka katalog berubah bila katalognya berubah — tidak ada
 * jawaban per pertanyaan.
 */
import { describe, expect, it } from 'vitest';
import { understood } from '../../understanding/testing/understood.js';
import { factTopics } from '../infrastructure/knowledge-facts.js';
import { answersFromKnowledge } from './intent-router.js';
import { knowledgeAnswer, type KnowledgeCatalog } from './knowledge-answer.js';

const NAMES: Record<string, string[]> = {
  'PVC AW': ['Pipa (TS End) Putih AW 1/2" x 4 Meter', 'Pipa (Bell End ) Abu AW 3 " x 5.8 Meter'],
  'PVC D': ['Pipa (Plain End) Abu D 1 1/2" x 4 Meter'],
  HDPE: [
    'Pipa HDPE PE 100 PN-8 160 mm x 9 Meter',
    'Pipa HDPE PE 100 PN-16 63 mm x 6 Meter',
    'Pipa HDPE Gas SDR-11 110 mm x 100 Meter Kuning',
  ],
  MDPE: ['Pipa MDPE SDR-11 110 mm x 100 Meter Kuning', 'Pipa MDPE SDR-11 20 mm x 100 Meter Kuning'],
  'PVC HIC': [
    'Pipa High Impact Conduit 20mm x 2.88 Meter',
    'Pipa High Impact Conduit 32mm x 2.88 Meter',
  ],
};
const catalog: KnowledgeCatalog = {
  familyCounts: async () =>
    Object.entries(NAMES).map(([family, n]) => ({ family, count: n.length })),
  productNamesInFamily: async (family) => NAMES[family] ?? [],
};

describe('knowledgeAnswer', () => {
  it('jumlah batang dihitung dari panjang jalur di pesan dan panjang batang katalog', async () => {
    const a = await knowledgeAnswer(
      ['jumlah batang'],
      'jalur 27 meter butuh berapa batang?',
      catalog,
      'id',
    );
    expect(a!.text).toContain(
      '**PVC AW** untuk 27 m: batang 4 m → 7 batang; batang 5,8 m → 5 batang',
    );
    expect(a!.text).toContain('**PVC D** untuk 27 m: batang 4 m → 7 batang');
  });

  it('pipa gas: fakta + produk gas di katalog (MDPE, HDPE gas saja)', async () => {
    const a = await knowledgeAnswer(['pipa gas'], 'pipa buat jalur gas rumah?', catalog, 'id');
    expect(a!.text).toContain('MDPE atau HDPE gas');
    expect(a!.text).toContain('**MDPE** — 2 produk · ukuran 20 mm–110 mm');
    expect(a!.text).toContain('**HDPE** — 1 produk · ukuran 110 mm');
  });

  it('tekanan kerja: tanpa angka per kelas PVC, kelas tekanan HDPE dari nama produk', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'tekanan kerja pipa aw berapa?',
      catalog,
      'id',
    );
    expect(a!.text).toContain('tim teknis Pralon bisa memberikan angkanya');
    expect(a!.text).toMatch(
      /\*\*HDPE\*\* — 3 produk · ukuran 63 mm–160 mm · kelas PN-8, PN-16, SDR-11/,
    );
  });

  it('conduit: fakta + HIC dengan panjang batang dari katalog', async () => {
    const a = await knowledgeAnswer(['conduit'], 'conduit itu apa?', catalog, 'id');
    expect(a!.text).toContain('bukan pipa air');
    expect(a!.text).toContain('panjang 2,88 m');
  });

  it('aplikasi: jenis produk HDPE dari nama produk katalog', async () => {
    const a = await knowledgeAnswer(['aplikasi'], 'hdpe dipakai buat apa saja?', catalog, 'id');
    expect(a!.text).toContain('**HDPE** — 3 produk · ukuran 63 mm–160 mm · jenis: ');
    expect(a!.text).toContain('Pipa HDPE Gas');
  });

  it('topik tanpa fakta maupun konsep → null', async () => {
    expect(await knowledgeAnswer([], 'halo', catalog, 'id')).toBeNull();
  });

  it('bahasa Inggris memakai teks Inggris', async () => {
    const a = await knowledgeAnswer(['umur pakai'], 'how long does hdpe last?', catalog, 'en');
    expect(a!.text).toContain('official service-life figure');
  });
});

describe('answersFromKnowledge', () => {
  it('topik bersumber menang atas intent ragu; kebutuhan bangunan tetap kebutuhan kecuali hitung batang', () => {
    expect(factTopics().has('pipa gas')).toBe(true);
    expect(answersFromKnowledge(understood('pipa gas?', { knowledgeTopics: ['pipa gas'] }))).toBe(
      true,
    );
    expect(
      answersFromKnowledge(
        understood('rumah 2 lantai pakai air panas', {
          intent: 'requirement_building',
          knowledgeTopics: ['air panas'],
        }),
      ),
    ).toBe(false);
    expect(
      answersFromKnowledge(
        understood('27 meter butuh berapa batang', {
          intent: 'requirement_building',
          knowledgeTopics: ['jumlah batang'],
        }),
      ),
    ).toBe(true);
    expect(
      answersFromKnowledge(understood('pipa pvc disimpan', { knowledgeTopics: ['penyimpanan'] })),
    ).toBe(false);
  });
});

describe('nilai tekanan di pesan', () => {
  it('bahan + "8-12 bar" dijawab dari pengetahuan tekanan kerja; tanpa bahan tidak', () => {
    const msg = 'lebih baik pipa HDPE atau uPVC untuk tekanan 8-12 bar?';
    expect(
      answersFromKnowledge(
        understood(msg, { intent: 'advice_request', families: ['hdpe', 'pvc'] }),
      ),
    ).toBe(true);
    expect(
      answersFromKnowledge(
        understood('pompa saya 8 bar', { intent: 'advice_request', families: [] }),
      ),
    ).toBe(false);
  });
});

describe('tes FAQ sales 2026-10-12', () => {
  it('DE-07: subjek HDPE — fakta kegunaan uPVC tidak dipakai, kegunaan HDPE dari jenis katalog', async () => {
    const a = await knowledgeAnswer(
      ['aplikasi'],
      'selain air minum, kegunaan pipa hdpe apa?',
      catalog,
      'id',
      ['hdpe'],
    );
    expect(a!.text.startsWith('Selain air minum dan air bersih, pipa HDPE Pralon')).toBe(true);
    expect(a!.text).toContain('jalur gas');
    expect(a!.text).not.toContain('uPVC dipakai untuk');
  });

  it('DE-11: kalimat pertama menjawab langsung bila bahannya disebut; batas suhu → data belum ada', async () => {
    const a = await knowledgeAnswer(
      ['air panas'],
      'pipa pvc bisa buat air panas pengganti ppr?',
      catalog,
      'id',
      ['pvc', 'ppr'],
    );
    expect(a!.text.split('\n')[0]).toBe(
      'Tidak — pipa PVC tidak bisa menggantikan PPR untuk air panas.',
    );
    expect(a!.gaps).toEqual([{ topic: 'air panas', gap: 'batas suhu operasi resmi' }]);
  });

  it('DE-01: 8–12 bar — kelas HDPE di atas 12 bar dengan selisihnya; PVC tanpa angka → tim teknis', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'HDPE atau uPVC untuk tekanan 8-12 bar?',
      catalog,
      'id',
      ['hdpe', 'pvc'],
    );
    expect(a!.text).toContain('Untuk tekanan 8–12 bar');
    expect(a!.text).toContain('lonjakan tekanan (water hammer)');
    expect(a!.text).toContain(
      '**HDPE** di katalog Pralon yang kelasnya di atas 12 bar: PN-16 (selisih 4 bar)',
    );
    expect(a!.text).not.toContain('PN-8');
    expect(a!.text).toContain('angka tekanan kerja resmi tiap kelas PVC belum ada');
    // Paragraf umum tekanan kerja tidak ditumpuk di atas jawaban bernilai.
    expect(a!.text).not.toContain('Kelas pipa PVC menandai fungsinya');
    expect(a!.gaps.map((g) => g.gap)).toEqual(['tekanan kerja resmi tiap kelas PVC']);
  });

  it('pressureRange membaca rentang dan nilai tunggal', async () => {
    const { pressureRange } = await import('./knowledge-answer.js');
    expect(pressureRange('antara 8-12 bar')).toEqual({ min: 8, max: 12 });
    expect(pressureRange('tekanan 10 bar')).toEqual({ min: 10, max: 10 });
    expect(pressureRange('8 sampai 12,5 bar')).toEqual({ min: 8, max: 12.5 });
    expect(pressureRange('panjang 12 m')).toBeNull();
  });

  it('DE-02: umur pakai — jujur dan ditandai data belum ada', async () => {
    const a = await knowledgeAnswer(['umur pakai'], 'berapa daya tahan pipa hdpe?', catalog, 'id', [
      'hdpe',
    ]);
    expect(a!.text).toContain('bisa diminta ke tim teknis Pralon');
    expect(a!.text).not.toMatch(/data saya/);
    expect(a!.gaps).toEqual([{ topic: 'umur pakai', gap: 'umur pakai resmi' }]);
  });

  it('DE-08 / DE-12: fakta baru fungsi vs bahan dan jenis pipa baru', async () => {
    const f = await knowledgeAnswer(
      ['fungsi vs bahan'],
      'bedanya pipa drainase dan upvc?',
      catalog,
      'id',
    );
    expect(f!.text).toContain('drainase adalah fungsinya');
    const n = await knowledgeAnswer(
      ['jenis pipa baru'],
      'pipa terbaru setelah hdpe?',
      catalog,
      'id',
    );
    expect(n!.text).toContain('belum memuat jenis pipa yang lebih baru');
    expect(n!.gaps).toHaveLength(1);
  });
});

describe('isCaseStatement (MA-06 / MA-07)', () => {
  it('kasus dikenali + kebutuhan + angka → kasus; tanpa angka tetap pengetahuan', async () => {
    const { isCaseStatement } = await import('./intent-router.js');
    const base = { useCase: 'residential_cluster' as const, mentionsRequirement: true };
    expect(isCaseStatement(understood('pipa buat proyek perumahan 50 unit?', base))).toBe(true);
    expect(isCaseStatement(understood('saran pipa sambungan rumah?', base))).toBe(false);
    expect(
      isCaseStatement(
        understood('27 meter butuh berapa batang', { ...base, knowledgeTopics: ['jumlah batang'] }),
      ),
    ).toBe(false);
  });
});

describe('answersFromKnowledge — pertanyaan bentuk sistem sendiri (P22-02)', () => {
  it('topik fitting di pertanyaan tentang sistem pengguna tidak dijawab pengetahuan umum', () => {
    expect(
      answersFromKnowledge(
        understood('fitting apa saja yang perlu dibeli?', {
          intent: 'system_layout_question',
          knowledgeTopics: ['kesalahan umum'],
        }),
      ),
    ).toBe(false);
    expect(
      answersFromKnowledge(
        understood('fitting apa saja?', {
          intent: 'knowledge_question',
          knowledgeTopics: ['kesalahan umum'],
        }),
      ),
    ).toBe(true);
  });
});
