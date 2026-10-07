/**
 * Jawaban perusahaan: hanya bagian terverifikasi; yang tidak ada dikatakan tidak ada; tidak
 * pernah menjadi pertanyaan produk (TEST F).
 */
import { describe, expect, it } from 'vitest';
import { composeCompanyAnswer, type CompanyFacts } from './company-answer.js';
import { SECTIONS } from './company-profile.js';

const withCatalog: CompanyFacts = {
  sections: SECTIONS,
  productFamilies: new Map([
    ['PVC AW', ['Pipa PVC AW 1/2"', 'Pipa PVC AW 3/4"']],
    ['HDPE', ['Pipa HDPE PE100 63 mm']],
  ]),
};
const noCatalog: CompanyFacts = { sections: SECTIONS, productFamilies: new Map() };

describe('composeCompanyAnswer', () => {
  it('singkat: satu bagian (ikhtisar), tanpa daftar yang belum terverifikasi', () => {
    const a = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'brief',
      topic: 'company_overview',
      locale: 'id',
    });
    expect(a.text).toContain('Pralon adalah produsen sistem perpipaan');
    expect(a.text).not.toContain('**');
    expect(a.text).not.toContain('belum bisa saya verifikasi');
    expect(a.needsTeam).toBe(false);
  });

  it('standar: ikhtisar dulu, lalu ragam produk dari katalog, berlabel tebal', () => {
    const a = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'standard',
      topic: 'company_overview',
      locale: 'id',
    });
    expect(a.text.indexOf('**Profil perusahaan**')).toBeLessThan(
      a.text.indexOf('**Produk dan solusi**'),
    );
    // Keluarga + jumlah; anggota lengkapnya milik pertanyaan produk.
    expect(a.text).toContain('- **PVC AW** — 2 produk');
    expect(a.text).not.toContain('Pipa PVC AW 1/2"');
  });

  it('lengkap: semua bagian terverifikasi, lalu jujur tentang yang belum ada + tim Pralon', () => {
    const a = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'comprehensive',
      topic: 'company_profile',
      locale: 'id',
    });
    expect(a.text).toContain('Informasi yang dapat saya verifikasi saat ini:');
    expect(a.text).toContain('**Situs resmi**');
    // Sejarah, sertifikasi, kontak kini ada dari materi HRGA (OQ-54); visi/misi/distribusi belum.
    expect(a.text).toContain('**Sejarah**');
    expect(a.text).toContain('**Standar dan sertifikasi**');
    expect(a.text).toContain(
      'belum bisa saya verifikasi dari sumber resmi: distribusi, visi, misi',
    );
    expect(a.text).toContain('Saya tidak mengarangnya.');
    expect(a.needsTeam).toBe(true);
    // Tidak pernah menanyakan produk.
    expect(a.text).not.toContain('Produk mana yang Anda maksud');
  });

  it('TEST F: katalog tidak ada → ragam produk dikatakan belum tersedia, tetap tentang perusahaan', () => {
    const a = composeCompanyAnswer({
      facts: noCatalog,
      depth: 'comprehensive',
      topic: 'company_profile',
      locale: 'id',
    });
    expect(a.text).toContain('katalog resmi Pralon belum terpasang');
    expect(a.text).toContain('Pralon adalah produsen');
    expect(a.text).not.toContain('Produk mana');
  });

  it('topik tertentu yang belum terverifikasi (visi misi) → jujur; sejarah kini terjawab dari materi internal', () => {
    const a = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'standard',
      topic: 'vision_mission',
      locale: 'id',
    });
    expect(a.text).toContain('belum bisa saya verifikasi dari sumber resmi: visi, misi');
    const history = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'standard',
      topic: 'history',
      locale: 'id',
    });
    expect(history.text).toContain('Materi internal mencatat tonggak perusahaan');
    expect(history.text).toContain('Pralon adalah produsen');
  });

  it('pertanyaan ambigu "pralon itu apa?" → jawaban perusahaan + satu kalimat pembeda produk', () => {
    const a = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'standard',
      topic: 'company_overview',
      locale: 'id',
      ambiguous: true,
    });
    expect(a.text).toContain('Kalau yang Anda maksud produk Pralon tertentu');
  });

  it('en: label dan kalimat Inggris, angka/nama produk sama', () => {
    const id = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'comprehensive',
      topic: 'company_profile',
      locale: 'id',
    });
    const en = composeCompanyAnswer({
      facts: withCatalog,
      depth: 'comprehensive',
      topic: 'company_profile',
      locale: 'en',
    });
    expect(en.text).toContain('**Company profile**');
    expect(en.text).toContain('What I cannot verify from an official source yet');
    expect(en.text).toContain('- **HDPE** — 1 product');
    expect(en.text.split('**').length).toBe(id.text.split('**').length);
  });
});
