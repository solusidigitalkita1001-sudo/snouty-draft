/**
 * Pengetahuan PERUSAHAAN — terpisah dari pengetahuan produk (Fase 16).
 *
 * Pertanyaan "Pralon itu apa?", "company profile PT Pralon", "sejarahnya?" dijawab dari sini,
 * bukan dari katalog produk. Hanya bagian yang TERVERIFIKASI yang pernah ditampilkan; bagian
 * yang belum ada sumbernya disebut sebagai "belum bisa saya verifikasi", tidak dikarang.
 *
 * Sumber bagian hari ini (docs/OPEN_QUESTIONS.md OQ-54): yang bisa dibuktikan dari sistem ini
 * sendiri — nama merek, domain resmi, dan ragam produk dari katalog Pralon yang aktif. Sejarah,
 * pabrik, sertifikasi, visi-misi, kontak menunggu dokumen resmi dari pemilik; isi `SECTIONS`
 * dengan sumbernya, dan tampilan mengikuti.
 */
import type { Locale } from '@snouty/shared-types';

export type CompanySectionId =
  | 'overview'
  | 'business_focus'
  | 'product_categories'
  | 'markets'
  | 'manufacturing'
  | 'certifications'
  | 'quality'
  | 'vision'
  | 'mission'
  | 'distribution'
  | 'contact'
  | 'milestones'
  | 'sustainability'
  | 'affiliations'
  | 'website';

export interface Bilingual {
  readonly id: string;
  readonly en: string;
}

export interface CompanySection {
  readonly id: CompanySectionId;
  readonly text: Bilingual;
  /** Dokumen/sumber yang membuktikannya — wajib; bagian tanpa sumber tidak boleh ada. */
  readonly source: string;
}

export const COMPANY_NAME = 'PT Pralon';
export const COMPANY_BRAND = 'Pralon';
export const OFFICIAL_DOMAIN = 'pralon.co.id';

/** Urutan tampil dan label per bagian. */
export const SECTION_LABELS: Readonly<Record<CompanySectionId, Bilingual>> = {
  overview: { id: 'Profil perusahaan', en: 'Company profile' },
  milestones: { id: 'Sejarah', en: 'History' },
  business_focus: { id: 'Fokus bisnis', en: 'Business focus' },
  product_categories: { id: 'Produk dan solusi', en: 'Products and solutions' },
  manufacturing: { id: 'Pabrik dan fasilitas', en: 'Manufacturing and facilities' },
  certifications: { id: 'Standar dan sertifikasi', en: 'Standards and certifications' },
  quality: { id: 'Komitmen mutu', en: 'Quality commitments' },
  markets: { id: 'Pasar dan aplikasi', en: 'Markets and applications' },
  distribution: { id: 'Distribusi', en: 'Distribution' },
  vision: { id: 'Visi', en: 'Vision' },
  mission: { id: 'Misi', en: 'Mission' },
  sustainability: { id: 'Keberlanjutan', en: 'Sustainability' },
  affiliations: { id: 'Afiliasi', en: 'Affiliations' },
  contact: { id: 'Kontak dan kanal resmi', en: 'Contact and official channels' },
  website: { id: 'Situs resmi', en: 'Official website' },
};

export const SECTION_ORDER = Object.keys(SECTION_LABELS) as readonly CompanySectionId[];

/**
 * Bagian statis yang terverifikasi. `product_categories` tidak di sini: ia dibangun dari katalog
 * aktif saat dijawab, supaya selalu sama dengan yang dilihat di pencarian produk.
 */
export const SECTIONS: readonly CompanySection[] = [
  {
    id: 'overview',
    text: {
      id: 'Pralon adalah produsen sistem perpipaan di Indonesia — pipa dan fitting untuk air bersih dan kebutuhan instalasi lainnya.',
      en: 'Pralon is a piping-system manufacturer in Indonesia — pipes and fittings for clean water and other installation needs.',
    },
    source: 'Katalog produk Pralon aktif (impor ERP 2026-10-06)',
  },
  {
    id: 'website',
    text: {
      id: `Situs resmi: ${OFFICIAL_DOMAIN}.`,
      en: `Official website: ${OFFICIAL_DOMAIN}.`,
    },
    source: 'Domain resmi layanan ini (ai.pralon.co.id)',
  },
];

export function sectionLabel(id: CompanySectionId, locale: Locale): string {
  return SECTION_LABELS[id][locale];
}
