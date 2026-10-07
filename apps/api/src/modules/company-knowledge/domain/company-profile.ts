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
// Urutan = urutan tampil; kedalaman "standar" membuka tiga bagian pertama, jadi "Pralon itu apa?"
// dijawab ikhtisar → fokus bisnis → ragam produk dari katalog, bukan sejarah lebih dulu.
export const SECTION_LABELS: Readonly<Record<CompanySectionId, Bilingual>> = {
  overview: { id: 'Profil perusahaan', en: 'Company profile' },
  business_focus: { id: 'Fokus bisnis', en: 'Business focus' },
  product_categories: { id: 'Produk dan solusi', en: 'Products and solutions' },
  markets: { id: 'Pasar dan aplikasi', en: 'Markets and applications' },
  manufacturing: { id: 'Pabrik dan fasilitas', en: 'Manufacturing and facilities' },
  quality: { id: 'Komitmen mutu', en: 'Quality commitments' },
  certifications: { id: 'Standar dan sertifikasi', en: 'Standards and certifications' },
  milestones: { id: 'Sejarah', en: 'History' },
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
/**
 * Sumber materi internal (OQ-54, 2026-10-07): "Snouty Product Knowledge Master — uPVC PRALON"
 * v1.0, disusun pemilik bersama HRGA dari deck product knowledge & BIMTEK
 * (`data/company/Snouty_Product_Knowledge_Master.md`). Dokumen itu sendiri menandai sejarah
 * "pelopor/pertama" dan nomor sertifikat sebagai perlu validasi korporat — yang diambil di sini
 * hanya yang disebut konsisten, dan tanpa angka yang ditandai konflik.
 */
const KNOWLEDGE_MASTER = 'Snouty Product Knowledge Master v1.0 (materi internal HRGA, 2026-10)';

export const SECTIONS: readonly CompanySection[] = [
  {
    id: 'overview',
    text: {
      id: 'PT Pralon adalah produsen sistem perpipaan di Indonesia: pipa uPVC (merek PRALON dan PIPPO), pipa HDPE, pipa conduit dan subduct, pipa jacking, fitting injeksi uPVC, serta solvent cement — untuk air bersih, air minum, air buangan, dan kebutuhan instalasi lainnya.',
      en: 'PT Pralon is a piping-system manufacturer in Indonesia: uPVC pipe (PRALON and PIPPO brands), HDPE pipe, conduit and subduct, jacking pipe, injection-moulded uPVC fittings, and solvent cement — for clean water, drinking water, drainage, and other installation needs.',
    },
    source: `${KNOWLEDGE_MASTER} §5, §29; katalog produk Pralon aktif (impor ERP 2026-10-06)`,
  },
  {
    id: 'business_focus',
    text: {
      id: 'Portofolio produk: pipa uPVC standar PRALON (kelas AW, D, C), pipa uPVC JIS (VP, VU), pipa uPVC SNI air minum dan SNI air buangan/drainase, pipa PIPPO (AW, D), pipa High Impact Conduit (HIC), pipa jacking, solvent cement, dan fitting injeksi uPVC. Pipa dibuat dari uPVC (unplasticized PVC — PVC tanpa plasticizer, sehingga kaku, ringan, tahan karat, berpermukaan licin, dan isolator listrik).',
      en: 'Product portfolio: PRALON standard uPVC pipe (classes AW, D, C), JIS uPVC pipe (VP, VU), SNI drinking-water and SNI drainage uPVC pipe, PIPPO pipe (AW, D), High Impact Conduit (HIC), jacking pipe, solvent cement, and injection-moulded uPVC fittings. Pipes are made of uPVC (unplasticized PVC — PVC without plasticizer, hence rigid, light, rust-free, smooth-bored, and electrically insulating).',
    },
    source: `${KNOWLEDGE_MASTER} §3, §5, §6`,
  },
  {
    id: 'markets',
    text: {
      id: 'Sektor pemakaian yang disebut: air bersih dan air minum, air buangan dan drainase, pertanian dan irigasi, bangunan dan perumahan (plumbing), saluran air hujan, telekomunikasi (conduit/subduct), listrik (conduit), dan industri.',
      en: 'Sectors served: clean and drinking water, drainage and sewerage, agriculture and irrigation, buildings and housing (plumbing), stormwater, telecommunications (conduit/subduct), electrical conduit, and industry.',
    },
    source: `${KNOWLEDGE_MASTER} §25`,
  },
  {
    id: 'manufacturing',
    text: {
      id: 'Pipa uPVC diproduksi dengan alur: penerimaan dan inspeksi material, formulasi (R&D), penimbangan, mixing, ekstrusi, vacuum tank, pendinginan spray, marking, haul-off, pemotongan, pembentukan ujung TS End (sambungan lem) atau Bell End (sambungan rubber ring), lalu quality control sebelum masuk gudang barang jadi. Fitting dibuat dengan injection moulding.',
      en: 'uPVC pipe is made through incoming material inspection, formulation (R&D), weighing, mixing, extrusion, vacuum tank, spray cooling, marking, haul-off, cutting, TS End (solvent-cement socket) or Bell End (rubber-ring socket) forming, then quality control before finished-goods storage. Fittings are injection-moulded.',
    },
    source: `${KNOWLEDGE_MASTER} §4, §20.3`,
  },
  {
    id: 'quality',
    text: {
      id: 'Pengendalian mutu mencakup inspeksi visual, pemeriksaan dimensi (diameter luar, ovalitas, tebal dinding, panjang), serta uji laboratorium: hidrostatik/burst, ketahanan methylene chloride, longitudinal reversion, tensile dan elongation, flattening, impact, dan Vicat softening point.',
      en: 'Quality control covers visual inspection, dimensional checks (outside diameter, ovality, wall thickness, length), and laboratory tests: hydrostatic/burst, methylene-chloride resistance, longitudinal reversion, tensile and elongation, flattening, impact, and Vicat softening point.',
    },
    source: `${KNOWLEDGE_MASTER} §8, §9`,
  },
  {
    id: 'certifications',
    text: {
      id: 'Materi internal menyebut sertifikasi ISO 9001, ISO 14001, ISO 45001, SNI, TKDN, Green Label Indonesia, formulasi Calcium-Zinc (bebas timbal), dan SJPH. Nomor sertifikat dan masa berlakunya belum tersedia untuk ditampilkan di sini — register sertifikat resmi menyusul.',
      en: 'Internal material lists ISO 9001, ISO 14001, ISO 45001, SNI, TKDN, Green Label Indonesia, Calcium-Zinc (lead-free) formulation, and SJPH certification. Certificate numbers and validity dates are not available here yet — the official certificate register is pending.',
    },
    source: `${KNOWLEDGE_MASTER} §29.3 (menunggu Certificate Register resmi)`,
  },
  {
    id: 'milestones',
    text: {
      id: 'Materi internal mencatat tonggak perusahaan: awal produksi pipa uPVC di Indonesia, joint venture, mulai memproduksi HDPE, ekspansi pabrik, produksi conduit dan subduct, serta fitting injeksi. Tahun dan urutan resminya menunggu profil perusahaan korporat.',
      en: 'Internal material records company milestones: early uPVC pipe production in Indonesia, a joint venture, the start of HDPE production, plant expansion, conduit and subduct production, and injection-moulded fittings. Official years and order await the corporate company profile.',
    },
    source: `${KNOWLEDGE_MASTER} §29.2 (menunggu validasi korporat)`,
  },
  {
    id: 'contact',
    text: {
      id: 'Kantor pusat: Synergy Building, Alam Sutera. Email: info@pralon.com.',
      en: 'Head office: Synergy Building, Alam Sutera. Email: info@pralon.com.',
    },
    source: `${KNOWLEDGE_MASTER} §29.1`,
  },
  {
    id: 'website',
    text: {
      id: `Situs resmi: www.pralon.com; asisten ini di ${OFFICIAL_DOMAIN}.`,
      en: `Official website: www.pralon.com; this assistant lives at ${OFFICIAL_DOMAIN}.`,
    },
    source: `${KNOWLEDGE_MASTER} §29.1; domain layanan ini (ai.pralon.co.id)`,
  },
];

export function sectionLabel(id: CompanySectionId, locale: Locale): string {
  return SECTION_LABELS[id][locale];
}
