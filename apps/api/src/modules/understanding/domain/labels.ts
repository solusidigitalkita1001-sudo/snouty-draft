/**
 * Label yang dipahami kode. Ini satu-satunya bagian pemahaman bahasa yang hidup di kode:
 * **perilaku per label** adalah aturan bisnis, **contoh kalimatnya** adalah data
 * (`data/understanding/*.json`). Menambah pemahaman baru = menambah contoh, bukan kode;
 * menambah PERILAKU baru = label baru di sini plus aturan yang menanganinya.
 *
 * Berkas data yang memakai label di luar daftar ini ditolak saat dimuat — supaya tidak ada
 * contoh yang diam-diam tidak pernah berbuah apa pun.
 */

export const FINE_INTENTS = [
  // sosial / pembuka
  'greeting',
  'thanks',
  'ack',
  'bye',
  // keluhan atas jawaban sebelumnya ("dongo", "ga nyambung") — minta maaf, minta diperjelas
  'complaint',
  'out_of_scope',
  // perusahaan & pesaing
  'company_question',
  'competitor_question',
  // produk & pengetahuan
  'product_concept',
  'product_comparison',
  'product_spec',
  'product_range',
  'price_question',
  'use_question',
  'knowledge_question',
  'advice_request',
  // kebutuhan
  'requirement_building',
  'requirement_irrigation',
  'requirement_technical',
  'requirement_mutation',
  'clarification_answer',
  'explanation_request',
  // lanjutan atas subjek aktif — maknanya hanya relatif terhadap yang sedang dibicarakan;
  // bentuk penyajian yang diminta (tabel/butir/ringkasan) dibaca katalog `format`.
  'follow_up_continue',
  'follow_up_more',
  'follow_up_brief',
  'follow_up_reference',
  'follow_up_choice',
  'follow_up_reformat',
] as const;
export type FineIntent = (typeof FINE_INTENTS)[number];

export const DEPTHS = ['brief', 'detailed', 'comprehensive'] as const;
export type DepthLabel = (typeof DEPTHS)[number];

export const FORMATS = ['table', 'bullets', 'summary'] as const;
export type FormatLabel = (typeof FORMATS)[number];

export const COMPANY_TOPICS = [
  'company_profile',
  'history',
  'products',
  'manufacturing',
  'certifications',
  'vision_mission',
  'contact',
] as const;
export type CompanyTopicLabel = (typeof COMPANY_TOPICS)[number];

/** Kosakata tertutup yang sama dengan `product-knowledge/domain/product-aspect.ts`. */
export const PRODUCT_ASPECTS = [
  'sizes',
  'size_availability',
  'compatible_fittings',
  'material',
  'standard',
  'pressure_class',
  'rod_length',
  'joint_type',
  'application',
] as const;
export type ProductAspectLabel = (typeof PRODUCT_ASPECTS)[number];

/** Topik pengetahuan pipa — `topic` di `context/application/pipe-knowledge.ts`. */
export const KNOWLEDGE_TOPICS = [
  'fitting',
  'upvc',
  'istilah dimensi',
  'sambungan lem',
  'sambungan rubber ring',
  'jenis fitting',
  'penyimpanan',
  'perawatan dan gangguan',
  'proses produksi',
  'uji mutu',
  'penimbunan',
  'uji tekanan lapangan',
  'air panas',
  'kelas pvc',
  'pipa tanam',
  'bertekanan vs gravitasi',
  'kaku vs lentur',
  'vp vu',
  'injection fitting',
  'pipa jacking',
  'conduit',
  'pipa gas',
  'ketahanan kimia',
  'umur pakai',
  'solvent cement',
  'ukuran inci',
  'panjang batang',
  'jumlah batang',
  'tekanan kerja',
  'pippo',
  'sni',
  'jenis ujung',
  'kesalahan umum',
] as const;
export type KnowledgeTopicLabel = (typeof KNOWLEDGE_TOPICS)[number];

/**
 * Label CONTOH NEGATIF yang boleh ada di katalog mana pun: kalimat yang TIDAK membawa keputusan
 * katalog itu ("apa bedanya pvc dan hdpe?" bukan permintaan tabel). Bila contoh terdekat sebuah
 * pesan ada di label ini, katalog menjawab "tidak ada" — jadi batas antara ada/tidak ada pun
 * dipelajari dari data, bukan hanya dari ambang.
 */
export const NONE_LABEL = 'none';

/**
 * Arah MUTASI kebutuhan (P16-12): "tambah satu kamar mandi" menambah atas state, "kurangi satu
 * wastafel" mengurangi; tanpa label (atau `none`: "kamar mandinya jadi 4") nilainya absolut.
 */
export const MUTATION_OPS = ['add', 'remove'] as const;
export type MutationOpLabel = (typeof MUTATION_OPS)[number];

/**
 * Jenis KASUS instalasi (P16-14) — sama persis dengan `CaseId` di `packages/engineering`; modul ini
 * tidak boleh mengimpor engineering, jadi daftarnya ditulis ulang dan dijaga tes `context`.
 */
export const USE_CASES = [
  'residential_clean_water',
  'multistorey_building_water',
  'residential_cluster',
  'irrigation',
  'pump_transfer',
  'gravity_drainage',
  'stormwater',
  'culvert',
  'well_distribution',
  'fish_pond',
] as const;
export type UseCaseLabel = (typeof USE_CASES)[number];

/** Nama katalog data → label yang sah di dalamnya. */
export const CATALOG_LABELS: Readonly<Record<string, readonly string[]>> = {
  intent: FINE_INTENTS,
  depth: DEPTHS,
  format: FORMATS,
  'company-topic': COMPANY_TOPICS,
  'product-aspect': PRODUCT_ASPECTS,
  'knowledge-topic': KNOWLEDGE_TOPICS,
  'mutation-op': MUTATION_OPS,
  'use-case': USE_CASES,
};
export type CatalogName = keyof typeof CATALOG_LABELS;

export function isFollowUp(intent: FineIntent | null | undefined): boolean {
  return intent !== null && intent !== undefined && intent.startsWith('follow_up_');
}

export function isRequirement(intent: FineIntent | null | undefined): boolean {
  return (
    intent === 'requirement_building' ||
    intent === 'requirement_irrigation' ||
    intent === 'requirement_technical' ||
    intent === 'requirement_mutation' ||
    intent === 'clarification_answer'
  );
}

export function isProductQuestion(intent: FineIntent | null | undefined): boolean {
  return (
    intent === 'product_concept' ||
    intent === 'product_comparison' ||
    intent === 'product_spec' ||
    intent === 'product_range' ||
    intent === 'price_question' ||
    intent === 'use_question' ||
    intent === 'knowledge_question' ||
    intent === 'advice_request'
  );
}

/** Pertanyaan tentang bahan/komponen itu sendiri (definisi, perbandingan) — bukan cara/aspek. */
export function isConceptual(intent: FineIntent | null | undefined): boolean {
  return intent === 'product_concept' || intent === 'product_comparison';
}

export function isSocial(
  intent: FineIntent | null | undefined,
): intent is 'thanks' | 'ack' | 'bye' | 'complaint' {
  return intent === 'thanks' || intent === 'ack' || intent === 'bye' || intent === 'complaint';
}

/** Lanjutan yang hanya mengubah BENTUK/KEDALAMAN jawaban — bukan memilih di antara pilihan. */
export function isPresentationFollowUp(intent: FineIntent | null | undefined): boolean {
  return (
    intent === 'follow_up_more' ||
    intent === 'follow_up_brief' ||
    intent === 'follow_up_reformat' ||
    intent === 'follow_up_reference'
  );
}
