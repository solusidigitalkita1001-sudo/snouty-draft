/**
 * Pertanyaan merek pesaing ("Pralon vs Ruchika?") — keputusan pemilik 2026-10-12, pilihan (b):
 * merek lain tidak dibahas atau dinilai, tetapi jawabannya menjelaskan apa yang dimiliki Pralon,
 * dari bagian profil perusahaan yang TERVERIFIKASI (`company-profile.ts`) — tidak ada klaim baru di
 * sini. Ditutup dengan tawaran tim teknis (kartu CTA dari pemanggil).
 *
 * Bila pertanyaannya tentang satu produk ("solvent cement Pralon vs lem merek lain"), yang dijelaskan
 * produk Pralon itu dari fakta pengetahuannya — bukan profil perusahaan umum (uji sales 2026-10-20).
 */
import type { Locale } from '@snouty/shared-types';
import { SECTIONS, type CompanySectionId } from '../../company-knowledge/domain/company-profile.js';
import { knowledgeFacts } from '../infrastructure/knowledge-facts.js';
import { conceptsFor } from './pipe-knowledge.js';

/** Bagian profil yang menjawab "kenapa Pralon", urut pengaruhnya pada pemilihan pipa. */
const POINTS: readonly {
  readonly section: CompanySectionId;
  readonly id: string;
  readonly en: string;
}[] = [
  { section: 'business_focus', id: 'Ragam produk', en: 'Product range' },
  { section: 'certifications', id: 'Standar dan sertifikasi', en: 'Standards and certifications' },
  { section: 'quality', id: 'Kontrol mutu', en: 'Quality control' },
];

export function competitorAnswer(locale: Locale, topics: readonly string[] = []): string {
  const en = locale === 'en';
  const support = en
    ? '- **Technical support** — the Pralon technical team can help choose the class, size, and installation method for your project.'
    : '- **Dukungan teknis** — tim teknis Pralon bisa membantu memilih kelas, ukuran, dan cara pasang untuk proyek Anda.';
  const product = productKnowledge(topics, locale);
  if (product !== null) {
    const opening = en
      ? "I can't assess other brands' products, but here is what the Pralon product does:"
      : 'Produk merek lain tidak bisa saya nilai, tapi ini yang bisa saya jelaskan tentang produk Pralon-nya:';
    return [opening, '', product, '', support.slice(2)].join('\n');
  }
  const points = POINTS.flatMap((point) => {
    const section = SECTIONS.find((s) => s.id === point.section);
    return section
      ? [`- **${en ? point.en : point.id}** — ${en ? section.text.en : section.text.id}`]
      : [];
  });
  const opening = en
    ? "I can't assess other brands, but here is what Pralon offers that you can check:"
    : 'Merek lain tidak bisa saya nilai, tapi ini yang dimiliki Pralon dan bisa Anda periksa:';
  return [opening, '', ...points, support].join('\n');
}

/** Fakta dan konsep topik terdekat — hanya kalimat bersumber, tanpa data katalog. */
function productKnowledge(topics: readonly string[], locale: Locale): string | null {
  // Hanya pertanyaan yang jelas tentang SATU produk: "kenapa pilih Pralon dibanding Vinilon?" sempat
  // membawa tiga topik lepas (PIPPO, proses produksi, air minum) — itu pertanyaan merek, bukan produk.
  if (topics.length !== 1) return null;
  const topic = topics[0]!;
  const en = locale === 'en';
  const texts = [
    ...conceptsFor([topic])
      .filter((c) => c.topic === topic)
      .map((c) => (en ? c.textEn : c.text)),
    ...knowledgeFacts()
      .filter((f) => f.topic === topic)
      .map((f) => (en ? f.textEn : f.text)),
  ].filter((t) => t !== '');
  return texts.length > 0 ? texts.join('\n\n') : null;
}
