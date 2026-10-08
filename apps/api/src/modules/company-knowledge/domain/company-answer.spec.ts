/**
 * Jawaban perusahaan: hanya bagian bersumber, berbentuk obrolan (tanpa judul tebal, tanpa kalimat
 * tentang "verifikasi"), lanjutan hanya menambah yang belum diceritakan, dan tidak pernah menjadi
 * pertanyaan produk (TEST F). Audit keterbacaan 2026-10-08.
 */
import { describe, expect, it } from 'vitest';
import { composeCompanyAnswer, sectionsShownAt, type CompanyFacts } from './company-answer.js';
import { SECTIONS } from './company-profile.js';

const withCatalog: CompanyFacts = {
  sections: SECTIONS,
  productFamilies: new Map([
    ['PVC AW', ['Pipa PVC AW 1/2"', 'Pipa PVC AW 3/4"']],
    ['HDPE', ['Pipa HDPE PE100 63 mm']],
  ]),
};
const noCatalog: CompanyFacts = { sections: SECTIONS, productFamilies: new Map() };

const answer = (over: Partial<Parameters<typeof composeCompanyAnswer>[0]> = {}) =>
  composeCompanyAnswer({
    facts: withCatalog,
    depth: 'standard',
    topic: 'company_overview',
    locale: 'id',
    ...over,
  });

describe('composeCompanyAnswer — bentuk obrolan', () => {
  it('tidak ada judul tebal, metatext verifikasi, atau "materi internal" di kedalaman apa pun', () => {
    for (const depth of ['brief', 'standard', 'detailed', 'comprehensive'] as const) {
      for (const locale of ['id', 'en'] as const) {
        const a = answer({ depth, locale, topic: 'company_profile' });
        expect(a.text).not.toContain('**');
        expect(a.text).not.toMatch(
          /verifikasi|verify|Materi internal|Internal material|mengarang|make it up/i,
        );
      }
    }
  });

  it('singkat: ikhtisar saja, lalu tawaran lanjutan', () => {
    const a = answer({ depth: 'brief' });
    expect(a.text).toMatch(/^PT Pralon adalah produsen sistem perpipaan/);
    expect(a.text).toMatch(/Mau saya lanjutkan dengan ragam produknya dan pemakaiannya\?$/);
    expect(a.needsTeam).toBe(false);
  });

  it('ikhtisar perusahaan tidak memuat daftar hitungan keluarga katalog', () => {
    const a = answer({ depth: 'comprehensive', topic: 'company_profile' });
    expect(a.text).not.toContain('2 produk');
    expect(a.text).not.toContain('PVC AW —');
  });

  it('lanjutan hanya menambah bagian yang belum diceritakan — tidak mengulang', () => {
    const first = answer({ depth: 'standard', topic: 'company_profile' });
    const next = answer({
      depth: 'detailed',
      topic: 'company_profile',
      alreadyShown: sectionsShownAt('standard'),
    });
    expect(first.text).toContain('PT Pralon adalah produsen');
    expect(next.text).not.toContain('PT Pralon adalah produsen');
    expect(next.text).toContain('Pipanya dipakai untuk');
    const all = answer({
      depth: 'comprehensive',
      topic: 'company_profile',
      alreadyShown: sectionsShownAt('detailed'),
    });
    expect(all.text).not.toContain('Pipanya dipakai untuk');
    expect(all.text).toContain('Situs resminya www.pralon.com.');
    // Yang belum punya sumber disebut sekali, dengan jalan keluarnya.
    expect(all.text).toContain(
      'Untuk jaringan distribusi, visi, misi, program keberlanjutan, dan afiliasi, tim Pralon bisa mengirimkan profil perusahaan resminya.',
    );
    expect(all.needsTeam).toBe(true);
    const done = answer({
      depth: 'comprehensive',
      topic: 'company_profile',
      alreadyShown: 99,
    });
    expect(done.text).toMatch(/^Itu sudah semua yang bisa saya ceritakan tentang Pralon\./);
  });

  it('pabrik: lokasi yang belum dipegang dikatakan dulu, lalu proses produksinya', () => {
    const a = answer({ topic: 'manufacturing' });
    expect(a.text).toMatch(
      /^Lokasi pabriknya belum saya pegang; yang bisa saya ceritakan adalah proses produksinya\./,
    );
    expect(a.text).toContain('Pipa uPVC dibuat bertahap');
  });

  it('visi misi tanpa sumber → jalan keluarnya tim Pralon; sejarah terjawab tanpa "materi internal"', () => {
    const vm = answer({ topic: 'vision_mission' });
    expect(vm.text).toContain(
      'Untuk visi dan misi, tim Pralon bisa mengirimkan profil perusahaan resminya.',
    );
    expect(vm.needsTeam).toBe(true);
    const history = answer({ topic: 'history' });
    expect(history.text).toMatch(/^PT Pralon adalah produsen/);
    expect(history.text).toContain('Perjalanan Pralon mencakup');
  });

  it('TEST F: topik produk tanpa katalog → dikatakan belum tersedia, tetap tentang perusahaan', () => {
    const a = composeCompanyAnswer({
      facts: noCatalog,
      depth: 'standard',
      topic: 'products',
      locale: 'id',
    });
    expect(a.text).toContain('Produknya mencakup pipa uPVC standar PRALON');
    expect(a.text).not.toContain('Produk mana');
    const withProducts = answer({ topic: 'products' });
    expect(withProducts.text).toContain(
      'Di katalog Pralon yang aktif ada 2 keluarga produk, antara lain PVC AW, HDPE.',
    );
  });

  it('pertanyaan ambigu "pralon itu apa?" → jawaban perusahaan + satu kalimat pembeda produk', () => {
    const a = answer({ ambiguous: true });
    expect(a.text).toContain('Kalau yang Anda maksud produk Pralon tertentu');
    expect(a.text).not.toContain('Mau saya lanjutkan');
  });

  it('en: kalimat Inggris, jumlah paragraf sama dengan Indonesia', () => {
    const id = answer({ depth: 'comprehensive', topic: 'company_profile' });
    const en = answer({ depth: 'comprehensive', topic: 'company_profile', locale: 'en' });
    expect(en.text).toMatch(/^PT Pralon is a piping-system manufacturer/);
    expect(en.text).toContain('the Pralon team can send the official company profile');
    expect(en.text.split('\n\n').length).toBe(id.text.split('\n\n').length);
  });
});
