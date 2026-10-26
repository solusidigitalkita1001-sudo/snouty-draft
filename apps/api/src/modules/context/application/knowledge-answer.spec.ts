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
  'FITTING PVC': ['Faucet Socket Abu Ts 1/2"', 'Faucet Socket Abu Ts 2"', 'Elbow Abu Ts 3"'],
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
    // Dua keluarga → tabel berdampingan (pemilik 2026-10-20: "bisa disusun lebih rapi").
    expect(a!.text).toMatch(/\| \| \*\*(MDPE|HDPE)\*\* \| \*\*(MDPE|HDPE)\*\* \|/);
    expect(a!.text).toMatch(/\| Ukuran \| .*20 mm–110 mm/);
    expect(a!.text).not.toContain('produk ·');
  });

  it('tekanan kerja: tanpa angka per kelas PVC, kelas tekanan HDPE dari nama produk', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'tekanan kerja pipa aw berapa?',
      catalog,
      'id',
    );
    expect(a!.text).toContain('tim teknis Pralon bisa memberikan angkanya');
    expect(a!.text).toContain('Di katalog Pralon yang aktif:\n\n| | **HDPE** |');
    expect(a!.text).toContain('| Ukuran | 63 mm–160 mm |');
    expect(a!.text).toContain('| Kelas | PN-8, PN-16, SDR-11 |');
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

  it('beda AW sama D: tabel kelas lalu katalog kedua kelas, tanpa kalimat pengisi (pemilik 2026-10-20)', async () => {
    const a = await knowledgeAnswer(
      ['kelas pvc'],
      'perbedaan pipa AW sama D apa ?',
      catalog,
      'id',
      ['pvc aw', 'pvc d'],
    );
    expect(a!.text).toMatch(/^PVC AW dan PVC D sama-sama uPVC; bedanya di tebal dinding/);
    // Sifat tiap kelas dalam prosa (P27-13, pemilik 2026-10-23: "terlalu text book"); yang tetap
    // tabel hanyalah data katalog, yang memang berkolom.
    expect(a!.text).toContain('**PVC AW** dindingnya lebih tebal');
    expect(a!.text).toContain('dipakai untuk air bersih bertekanan');
    expect(a!.text).toContain('dipakai untuk pembuangan dan ventilasi');
    expect(a!.text).not.toContain('| Aspek |');
    expect(a!.text).not.toMatch(/mahal|murah|harga/i);
    // Satu kelas saja tetap paragraf konsep.
    const one = await knowledgeAnswer(['kelas pvc'], 'pipa aw itu apa?', catalog, 'id', ['pvc aw']);
    expect(one!.text).toMatch(/^AW, D, dan C adalah kelas pipa PVC Pralon/);
    const en = await knowledgeAnswer(['kelas pvc'], 'difference between AW and D?', catalog, 'en', [
      'pvc aw',
      'pvc d',
    ]);
    expect(en!.text).toContain('**PVC AW** has the thicker wall');
    expect(en!.text).not.toContain('| Aspect |');
    // Ukuran dan panjang katalog jadi baris tabel yang sama, bukan daftar kedua.
    expect(a!.text).toContain('| Ukuran | 1/2"–3" | 1 1/2" |');
    expect(a!.text).toContain('| Panjang batang | 4 m, 5,8 m | 4 m |');
    expect(a!.text).not.toContain('Di katalog Pralon yang aktif');
    expect(a!.text).not.toMatch(/JIS|PIPPO|tercatat di katalog/);
  });

  it('PVC ke galvanis: lewat ulir, Faucet Socket dari katalog dengan namanya sendiri (audit 2026-10-20)', async () => {
    const a = await knowledgeAnswer(
      ['sambungan transisi'],
      'nyambungin pipa pvc ke pipa galvanis lama gimana?',
      catalog,
      'id',
      ['pvc', 'galvanis'],
    );
    expect(a!.text).toMatch(/^Pipa PVC tidak bisa dilem ke pipa galvanis/);
    expect(a!.text).toContain('- **Faucet Socket** — 2 produk · ukuran 1/2"–2"');
    expect(a!.text).not.toContain('FITTING PVC');
  });

  it('subjek percakapan hanya mempersempit katalog: "panjang per batangnya?" setelah HDPE', async () => {
    const a = await knowledgeAnswer(
      ['panjang batang'],
      'panjang per batangnya?',
      catalog,
      'id',
      [],
      ['hdpe'],
    );
    expect(a!.text).toContain('**HDPE**');
    expect(a!.text).not.toContain('PVC AW');
  });

  it('panjang yang banyak (batang dan gulungan HDPE) ditulis rentang, bukan 100 angka', async () => {
    const many: KnowledgeCatalog = {
      familyCounts: async () => [{ family: 'HDPE', count: 12 }],
      productNamesInFamily: async () =>
        [6, 9, 12, 50, 100, 150, 200, 250, 300, 350, 400].map(
          (m) => `Pipa HDPE PE 100 PN-10 63 mm x ${m} Meter`,
        ),
    };
    const a = await knowledgeAnswer(
      ['panjang batang'],
      'panjang per batangnya?',
      many,
      'id',
      [],
      ['hdpe'],
    );
    expect(a!.text).toContain('panjang 6–400 m');
    expect(a!.text).not.toContain('150 m');
  });

  it('lebih dari empat keluarga: keluarga jadi baris supaya muat di ponsel (uji sales 2026-10-20)', async () => {
    const families = ['PVC AW', 'PVC D', 'PVC C', 'PVC VP', 'PVC VU'];
    const wide: KnowledgeCatalog = {
      familyCounts: async () => families.map((family) => ({ family, count: 1 })),
      productNamesInFamily: async (family) => [`Pipa ${family.slice(4)} 1/2" x 4 Meter`],
    };
    const a = await knowledgeAnswer(['panjang batang'], 'panjang batang pipa berapa?', wide, 'id');
    expect(a!.text).toContain('| | Ukuran | Panjang batang |');
    expect(a!.text).toContain('| **PVC VU** | 1/2" | 4 m |');
  });

  it('hitung batang hanya dari panjang yang lazim, bukan potongan 1 m', async () => {
    const rods: KnowledgeCatalog = {
      familyCounts: async () => [{ family: 'PVC AW', count: 11 }],
      productNamesInFamily: async () => [
        'Pipa AW 1/2" x 1 Meter',
        ...Array.from({ length: 10 }, (_, i) => `Pipa AW ${i + 1}" x 4 Meter`),
      ],
    };
    const a = await knowledgeAnswer(
      ['jumlah batang'],
      'jalur 27 meter butuh berapa batang?',
      rods,
      'id',
    );
    expect(a!.text).toContain('batang 4 m → 7 batang');
    expect(a!.text).not.toContain('27 batang');
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
    expect(a!.text).toContain('mengikuti angka tekanan kerja resmi di spesifikasi produk Pralon');
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
    // P28-06: dulu jawabannya "tidak ada jenis yang lebih baru" lalu melempar ke tim teknis —
    // mencampur "tidak ada di katalog Pralon" dengan "tidak ada di industri", dan memakai
    // eskalasi sebagai pengganti jawaban yang sebenarnya ada.
    expect(n!.text).toMatch(/PP-R|PE-X|PE-RT/);
    expect(n!.text).toContain('bukan produk Pralon');
    expect(n!.text).toMatch(/lebih baru tidak otomatis lebih baik/i);
    expect(n!.text).not.toMatch(/data saya/i);
    expect(n!.gaps).toHaveLength(0);
  });

  it('bahan di luar katalog dijawab sebagai konteks industri, bukan rekomendasi (P28-06)', async () => {
    const b = await knowledgeAnswer(
      ['bahan di luar katalog'],
      'selain pvc dan hdpe ada bahan pipa apa lagi?',
      catalog,
      'id',
    );
    expect(b!.text).toMatch(/ductile iron|GRP|tembaga/);
    expect(b!.text).toContain('Yang direkomendasikan di sini tetap produk Pralon');
    expect(b!.gaps).toHaveLength(0);
  });

  it('PVC-O dijelaskan beserta standarnya dan dinyatakan bukan produk Pralon (P30-02)', async () => {
    const a = await knowledgeAnswer(
      ['bahan di luar katalog'],
      'apa itu pipa pvc-o?',
      catalog,
      'id',
    );
    expect(a!.text).toContain('ISO 16422');
    expect(a!.text).toMatch(/molekulnya diorientasikan/);
    expect(a!.text).toContain('tidak dibuat Pralon');
  });

  it('arti SDR ikut dijawab, bukan hanya arahnya (P30-02)', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'beda sdr 11 dan sdr 17 di pipa hdpe apa?',
      catalog,
      'id',
      ['hdpe'],
    );
    expect(a!.text).toContain('perbandingan diameter luar terhadap tebal dinding');
    expect(a!.text).toMatch(/SDR 11 lebih tebal daripada SDR 17/);
  });

  it('pertanyaan tekanan HDPE tidak membawa paragraf kelas PVC maupun gap-nya (P30-05)', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'beda sdr 11 dan sdr 17 di pipa hdpe apa?',
      catalog,
      'id',
      ['hdpe'],
    );
    expect(a!.text).toContain('perbandingan diameter luar terhadap tebal dinding');
    // Paragraf kelas PVC benar, tetapi tidak ditanya — dan eskalasinya milik paragraf itu.
    expect(a!.text).not.toContain('AW untuk air bersih bertekanan');
    expect(a!.gaps).toHaveLength(0);
    // Kelas tekanan dari katalog tetap ikut: itu memang tentang HDPE.
    expect(a!.text).toMatch(/PN-8|PN-16/);
  });

  it('pertanyaan tekanan PVC tetap mendapat paragrafnya beserta gap tekanan kerja (P30-05)', async () => {
    const a = await knowledgeAnswer(
      ['tekanan kerja'],
      'tekanan kerja pipa aw berapa?',
      catalog,
      'id',
      ['pvc aw'],
    );
    expect(a!.text).toContain('AW untuk air bersih bertekanan');
    expect(a!.gaps.map((g) => g.gap)).toContain('tekanan kerja resmi tiap kelas PVC');
  });

  it('pemakaian menyebut batasnya, bukan hanya daftarnya (P30-05)', async () => {
    const upvc = await knowledgeAnswer(
      ['aplikasi'],
      'pipa pvc bisa dipakai buat kolam renang?',
      catalog,
      'id',
      ['pvc'],
    );
    expect(upvc!.text).toContain('Yang bukan tempatnya');
    expect(upvc!.text).toContain('ketahanan kimia');

    const pe = await knowledgeAnswer(
      ['aplikasi'],
      'pipa hdpe bisa dipakai buat air limbah ngga?',
      catalog,
      'id',
      ['hdpe'],
    );
    expect(pe!.text).toContain('air limbah dan drainase termasuk pemakaiannya');
    expect(pe!.text).toContain('bukan tempatnya: air panas');
  });

  it('kedalaman timbunan menyebut angka yang dipakai hitungan beserta statusnya (P30-05)', async () => {
    const a = await knowledgeAnswer(
      ['penimbunan'],
      'kalau pipa dilewati kendaraan, kedalaman timbunannya berapa?',
      catalog,
      'id',
    );
    expect(a!.text).toContain('sekitar 1 m');
    expect(a!.text).toContain('0,6 m');
    expect(a!.text).toContain('belum divalidasi tim teknis Pralon');
    expect(a!.gaps.map((g) => g.topic)).toContain('penimbunan');
  });

  it('pertanyaan kemiringan dijawab angkanya sendiri, bukan dari topik tetangga (P30-03, PP-33)', async () => {
    const a = await knowledgeAnswer(
      ['kemiringan buangan'],
      'kemiringan pipa air kotor berapa persen?',
      catalog,
      'id',
    );
    expect(a!.text).toContain('2 %');
    expect(a!.text).toContain('belum divalidasi');
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

/**
 * Cakupan FAQ (P27-10, pemilik 2026-10-23: "matengin lagi mengenai dataset FAQ").
 *
 * Invarian yang dipaku: setiap topik yang bisa dikenali pemahaman HARUS punya jawabannya — fakta
 * bersumber di `data/knowledge/pipe-facts.json` atau konsep di `pipe-knowledge.ts`. Topik yang
 * dikenali tetapi tidak punya jawaban berarti SNOUTY mengangguk lalu diam.
 */
describe('cakupan topik FAQ', () => {
  it('tiap topik yang dikenali punya fakta atau konsep', async () => {
    const { KNOWLEDGE_TOPICS } = await import('../../understanding/domain/labels.js');
    const { CONCEPTS } = await import('./pipe-knowledge.js');
    const facts = factTopics();
    const concepts = new Set(CONCEPTS.map((c) => c.topic));
    const orphan = KNOWLEDGE_TOPICS.filter((t) => !facts.has(t) && !concepts.has(t));
    expect(orphan).toEqual([]);
  });

  it('tiap topik punya contoh kalimat di katalog pemahaman', async () => {
    const { KNOWLEDGE_TOPICS } = await import('../../understanding/domain/labels.js');
    const { findDataDir } = await import('../../understanding/infrastructure/catalog-files.js');
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = findDataDir();
    expect(dir).not.toBeNull();
    const raw = readFileSync(join(dir!, 'knowledge-topic.json'), 'utf8');
    const labels = (JSON.parse(raw) as { labels: Record<string, readonly string[]> }).labels;
    for (const topic of KNOWLEDGE_TOPICS) {
      expect(labels[topic]?.length ?? 0, topic).toBeGreaterThanOrEqual(5);
    }
  });

  it('topik lapangan yang baru benar-benar menjawab, bukan kalimat kosong', () => {
    for (const topic of [
      'memotong pipa',
      'membersihkan pipa',
      'perbaikan bocor',
      'warna pipa',
      'pipa dicor',
      'pukulan air',
      'kemiringan buangan',
      'bau saluran',
    ] as const) {
      expect(factTopics().has(topic), topic).toBe(true);
    }
  });
});
