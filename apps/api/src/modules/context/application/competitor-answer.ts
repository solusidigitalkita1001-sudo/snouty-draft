/**
 * Pertanyaan merek pesaing ("Pralon vs Ruchika?") — keputusan pemilik 2026-10-12, pilihan (b):
 * merek lain tidak dibahas atau dinilai, tetapi jawabannya menjelaskan apa yang dimiliki Pralon,
 * dari bagian profil perusahaan yang TERVERIFIKASI (`company-profile.ts`) — tidak ada klaim baru di
 * sini. Ditutup dengan tawaran tim teknis (kartu CTA dari pemanggil).
 */
import type { Locale } from '@snouty/shared-types';
import { SECTIONS, type CompanySectionId } from '../../company-knowledge/domain/company-profile.js';

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

export function competitorAnswer(locale: Locale): string {
  const en = locale === 'en';
  const points = POINTS.flatMap((point) => {
    const section = SECTIONS.find((s) => s.id === point.section);
    return section
      ? [`- **${en ? point.en : point.id}** — ${en ? section.text.en : section.text.id}`]
      : [];
  });
  const support = en
    ? '- **Technical support** — the Pralon technical team can help choose the class, size, and installation method for your project.'
    : '- **Dukungan teknis** — tim teknis Pralon bisa membantu memilih kelas, ukuran, dan cara pasang untuk proyek Anda.';
  const opening = en
    ? "I can't assess other brands, but here is what Pralon offers that you can check:"
    : 'Merek lain tidak bisa saya nilai, tapi ini yang dimiliki Pralon dan bisa Anda periksa:';
  return [opening, '', ...points, support].join('\n');
}
