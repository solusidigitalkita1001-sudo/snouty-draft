/**
 * Implementasi `KnowledgeRetriever` di atas data katalog — **bukan** di atas MySQL
 * langsung. Dokumen dibaca lewat port baca katalog, jadi modul ini tidak punya satu
 * pun impor database (docs/ARCHITECTURE.md §7).
 *
 * Yang dicocokkan hanya **judul** dokumen, karena hanya itu yang disimpan sistem
 * ini: `product_documents` memuat judul, URL, dan halaman — tidak ada isi dokumen.
 * Itu bukan kekurangan implementasi, itu keadaan korpusnya. Dan keadaan itu adalah
 * bukti langsung untuk kriteria adopsi RAG #1: belum ada dokumen tak terstruktur
 * untuk di-embed (docs/PRODUCT_KNOWLEDGE.md §5).
 *
 * Ambang skor tetap ditegakkan walaupun pencocokannya sederhana. Alasannya bukan
 * ketelitian: "kembalikan apa pun yang paling mirip" adalah perilaku baku yang
 * paling sulit dicabut nanti, jadi ia tidak pernah dipasang sejak awal.
 */
import { Injectable } from '@nestjs/common';
import { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import {
  KNOWLEDGE_RETRIEVER,
  MINIMUM_RETRIEVAL_SCORE,
  type KnowledgeRetriever,
  type RetrievalFilter,
  type RetrievedChunk,
} from '../domain/knowledge-retriever.port.js';
import { ASPECT_LABEL } from '../domain/product-aspect.js';

const DEFAULT_LIMIT = 5;
/** Istilah sependek ini mencocokkan hampir apa pun dan hanya menambah derau. */
const MIN_TERM_LENGTH = 3;

@Injectable()
export class CatalogDocumentRetriever implements KnowledgeRetriever {
  constructor(private readonly catalog: CatalogQueryService) {}

  async retrieve(query: string, filter: RetrievalFilter): Promise<readonly RetrievedChunk[]> {
    const documents = await this.catalog.findProductDocuments(filter.productId);
    if (documents.length === 0) return [];

    // Label aspek ikut menjadi istilah pencarian: pertanyaan "tekanan kerjanya
    // berapa?" seharusnya menemukan dokumen berjudul "Tekanan kerja", walaupun
    // kalimat penggunanya tidak memuat kata itu persis.
    const terms = termsOf(`${query} ${ASPECT_LABEL[filter.aspect]}`);
    if (terms.length === 0) return [];

    const product = await this.catalog.findProduct(filter.productId);

    return documents
      .map((document) => ({
        title: document.title,
        url: document.url,
        sourceDocument: document.title,
        sourcePage: document.page,
        score: scoreOf(document.title, terms),
      }))
      .filter((chunk) => chunk.score >= MINIMUM_RETRIEVAL_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, filter.limit ?? DEFAULT_LIMIT)
      .map((chunk) => ({
        ...chunk,
        sourceDocument: chunk.sourceDocument || product.sourceDocument,
      }));
  }
}

/** Istilah unik, huruf kecil, tanpa yang terlalu pendek untuk membedakan apa pun. */
function termsOf(text: string): string[] {
  const terms = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= MIN_TERM_LENGTH);
  return [...new Set(terms)];
}

/** Proporsi istilah yang muncul di judul. 0 berarti tidak ada hubungannya. */
function scoreOf(title: string, terms: readonly string[]): number {
  const haystack = title.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return terms.length === 0 ? 0 : hits / terms.length;
}

export const knowledgeRetrieverProvider = {
  provide: KNOWLEDGE_RETRIEVER,
  inject: [CatalogQueryService],
  useFactory: (catalog: CatalogQueryService): KnowledgeRetriever =>
    new CatalogDocumentRetriever(catalog),
};
