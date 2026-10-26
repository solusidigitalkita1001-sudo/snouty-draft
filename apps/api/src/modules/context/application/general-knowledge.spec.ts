/**
 * Jalur pengetahuan umum pipa (P30-01). Yang dipaku di sini adalah PAGARNYA, karena jalur ini
 * satu-satunya yang memakai pengetahuan model dan bukan data bersumber:
 *   - jawaban tidak pernah menyebut Pralon (klaim Pralon hanya dari katalog dan fakta);
 *   - merek lain tidak pernah lolos;
 *   - jawaban berbentuk prosa, bukan judul/tabel/daftar butir;
 *   - angka apa pun membawa baris provenance yang ditempelkan KODE;
 *   - kegagalan model, keluaran rusak, dan jawaban kepanjangan jatuh ke `null` — pemanggil
 *     memakai jalur lamanya, bukan menampilkan apa pun yang tidak lolos.
 */
import { describe, expect, it } from 'vitest';
import { GeneralKnowledgeWriter, acceptedAnswer } from './general-knowledge.js';
import { PRODUCT_ANSWER_COPY, PRODUCT_ANSWER_COPY_EN } from './product-answer-text.js';

const prompt = () => 'PROMPT';
const answering = (raw: unknown) => ({
  calls: [] as unknown[],
  async writeProse(input: unknown) {
    this.calls.push(input);
    return raw;
  },
});

describe('pengetahuan umum pipa — pagar keluaran', () => {
  it('menerima prosa biasa apa adanya, tanpa baris tambahan', () => {
    const text = acceptedAnswer({
      text: 'Thrust block adalah blok beton yang menahan dorongan pipa di belokan dan percabangan, supaya sambungannya tidak tertarik lepas.',
    });
    expect(text).toContain('Thrust block adalah blok beton');
    expect(text).not.toContain(PRODUCT_ANSWER_COPY.generalPractice);
  });

  it('menempelkan provenance pada jawaban yang menyebut angka bersatuan', () => {
    const text = acceptedAnswer({
      text: 'Pipa PVC untuk air dingin dipakai sampai sekitar 40 °C menurut praktik yang lazim; di atas itu dindingnya melunak.',
    });
    expect(text).toContain(PRODUCT_ANSWER_COPY.generalPractice);
  });

  it('menempelkan provenance pada angka tanpa satuan baku ("2 persen", "60 derajat")', () => {
    const text = acceptedAnswer({
      text: 'Saluran buangan mendatar dipasang turun sekitar 2 persen mengikuti acuan plumbing yang umum dipakai.',
    });
    expect(text).toContain(PRODUCT_ANSWER_COPY.generalPractice);
  });

  it('memakai baris provenance Inggris untuk percakapan Inggris', () => {
    const text = acceptedAnswer(
      { text: 'PVC pipe for cold water is used up to about 40 °C in common practice.' },
      'en',
    );
    expect(text).toContain(PRODUCT_ANSWER_COPY_EN.generalPractice);
  });

  it('menolak jawaban yang menyebut Pralon — klaim Pralon bukan milik jalur ini', () => {
    expect(
      acceptedAnswer({ text: 'Untuk hal ini Pralon membuat pipa uPVC kelas AW yang sesuai.' }),
    ).toBeNull();
  });

  it('menolak jawaban yang menyebut merek lain', () => {
    expect(
      acceptedAnswer({ text: 'Pipa seperti Rucika juga memakai sistem yang sama.' }),
    ).toBeNull();
  });

  it('menolak judul, tabel, dan daftar butir — jawabannya prosa', () => {
    expect(acceptedAnswer({ text: '## Thrust block\n\nBlok beton penahan dorongan.' })).toBeNull();
    expect(acceptedAnswer({ text: '| Jenis | Fungsi |\n| --- | --- |\n| A | B |' })).toBeNull();
    expect(acceptedAnswer({ text: '- menahan dorongan\n- menahan belokan' })).toBeNull();
    expect(acceptedAnswer({ text: '**Fungsi utama**' })).toBeNull();
  });

  it('menolak jawaban yang kepanjangan untuk gelembung chat', () => {
    expect(acceptedAnswer({ text: 'a'.repeat(1_500) })).toBeNull();
  });

  it('menolak keluaran yang bukan {text} dan teks kosong', () => {
    expect(acceptedAnswer({ answer: 'begini' })).toBeNull();
    expect(acceptedAnswer('begini')).toBeNull();
    expect(acceptedAnswer({ text: '   ' })).toBeNull();
  });
});

describe('pengetahuan umum pipa — penulis', () => {
  it('memanggil model dengan tugas general_knowledge dan mengembalikan jawabannya', async () => {
    const ai = answering({ text: 'Butt fusion menyatukan dua ujung pipa dengan panas.' });
    const writer = new GeneralKnowledgeWriter(ai, prompt, 5_000);
    const answer = await writer.answer({
      message: 'apa itu butt fusion?',
      recentTurns: [],
      locale: 'id',
    });
    expect(answer).toContain('Butt fusion menyatukan');
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0]).toMatchObject({ task: 'general_knowledge', timeoutMs: 5_000 });
  });

  it('menyertakan pesan pengguna di konteks yang dikirim', async () => {
    const ai = answering({ text: 'Jawaban.' });
    await new GeneralKnowledgeWriter(ai, prompt).answer({
      message: 'apa itu thrust block?',
      recentTurns: [{ role: 'user', text: 'pipa 110 mm' }],
      locale: 'id',
    });
    expect((ai.calls[0] as { userMessage: string }).userMessage).toContain('apa itu thrust block?');
  });

  it('model yang gagal atau kehabisan waktu tidak menjatuhkan giliran', async () => {
    const failing = {
      async writeProse(): Promise<never> {
        throw new Error('model tidak terjangkau');
      },
    };
    const writer = new GeneralKnowledgeWriter(failing, prompt);
    await expect(
      writer.answer({ message: 'apa itu thrust block?', recentTurns: [], locale: 'id' }),
    ).resolves.toBeNull();
  });
});
