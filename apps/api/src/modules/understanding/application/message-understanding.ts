/**
 * Hasil pemahaman satu pesan — SEMUA keputusan bahasa dalam satu objek, dihitung sekali per
 * giliran (satu penyandian), lalu dibaca fungsi-fungsi murni di `context`.
 *
 * `null` berarti "tidak yakin", bukan "tidak". Pemanggil yang memutuskan apa artinya tidak
 * yakin: untuk intent → tanya model generatif; untuk aspek produk → pertanyaan konsep; untuk
 * topik perusahaan → ikhtisar.
 */
import type { LabelScore } from '../domain/classifier.js';
import type {
  CompanyTopicLabel,
  DepthLabel,
  FineIntent,
  FormatLabel,
  KnowledgeTopicLabel,
  ProductAspectLabel,
} from '../domain/labels.js';

export interface Match<L extends string = string> {
  readonly label: L;
  readonly score: number;
}

export interface MessageUnderstanding {
  readonly text: string;
  /** Penyandi tersedia dan contoh sudah tersandi; bila `false`, semua keputusan makna `null`. */
  readonly available: boolean;
  readonly intent: Match<FineIntent> | null;
  readonly depth: DepthLabel | null;
  readonly format: FormatLabel | null;
  readonly companyTopic: CompanyTopicLabel | null;
  readonly productAspect: ProductAspectLabel | null;
  readonly knowledgeTopics: readonly KnowledgeTopicLabel[];
  /** Keluarga produk yang disebut (kosakata), kanonis, urut kemunculan. */
  readonly families: readonly string[];
  readonly mentionsCompetitor: boolean;
  readonly mentionsOwnBrand: boolean;
  /** Menyebut bangunan/fixture/sumber air/jenis jalur (kosakata) — isyarat kebutuhan instalasi. */
  readonly mentionsRequirement: boolean;
  /** Peringkat intent lengkap — untuk log "kenapa dikenali begini". */
  readonly intentRanking: readonly LabelScore[];
}

/** Pemahaman kosong (penyandi tidak ada) — hanya kosakata yang terisi. */
export function unavailableUnderstanding(
  text: string,
  lexicon: {
    productFamilies(text: string): readonly string[];
    mentionsCompetitor(text: string): boolean;
    mentionsOwnBrand(text: string): boolean;
    mentionsRequirementEntity(text: string): boolean;
  } | null = null,
): MessageUnderstanding {
  return {
    text,
    available: false,
    intent: null,
    depth: null,
    format: null,
    companyTopic: null,
    productAspect: null,
    knowledgeTopics: [],
    families: lexicon?.productFamilies(text) ?? [],
    mentionsCompetitor: lexicon?.mentionsCompetitor(text) ?? false,
    mentionsOwnBrand: lexicon?.mentionsOwnBrand(text) ?? false,
    mentionsRequirement: lexicon?.mentionsRequirementEntity(text) ?? false,
    intentRanking: [],
  };
}

/** Untuk tes: pemahaman dengan nilai yang ditentukan, sisanya kosong. */
export function understandingOf(
  text: string,
  over: Partial<Omit<MessageUnderstanding, 'text' | 'intent'>> & {
    readonly intent?: FineIntent | Match<FineIntent> | null;
  } = {},
): MessageUnderstanding {
  const { intent, ...rest } = over;
  return {
    ...unavailableUnderstanding(text),
    available: true,
    intent: typeof intent === 'string' ? { label: intent, score: 1 } : (intent ?? null),
    ...rest,
  };
}
