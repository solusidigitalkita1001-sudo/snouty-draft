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
    expect(a!.text).toContain('data saya belum memuat angka yang sudah divalidasi');
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
