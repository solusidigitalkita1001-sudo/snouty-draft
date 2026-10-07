/**
 * CompanyKnowledgeService — retrieval pengetahuan perusahaan (Fase 16).
 *
 * Jalur: pertanyaan perusahaan → fakta terverifikasi (bagian statis + ragam produk dari katalog
 * Pralon yang aktif) → penyusun jawaban. Katalog dibaca lewat port `product-catalog` dan hanya
 * dipakai bila otoritatif; katalog yang tidak terbaca mengurangi satu bagian, bukan menggagalkan
 * jawaban — dan tidak pernah mengubah pertanyaan perusahaan menjadi pencarian produk.
 */
import type { AnswerDepth, Locale, Product } from '@snouty/shared-types';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { isAnswerable, isAuthoritative } from '../../product-catalog/domain/catalog-visibility.js';
import { CatalogUnavailableError } from '../../product-catalog/domain/catalog.errors.js';
import {
  composeCompanyAnswer,
  type CompanyAnswer,
  type CompanyFacts,
} from '../domain/company-answer.js';
import { SECTIONS } from '../domain/company-profile.js';

export type CompanyCatalog = Pick<CatalogQueryService, 'activeVersion' | 'listProducts'>;

export interface CompanyQuestion {
  readonly depth: AnswerDepth;
  readonly topic: string;
  readonly locale: Locale;
  readonly ambiguous?: boolean;
}

export class CompanyKnowledgeService {
  constructor(private readonly catalog: CompanyCatalog) {}

  async answer(question: CompanyQuestion): Promise<CompanyAnswer> {
    const facts = await this.facts();
    return composeCompanyAnswer({ facts, ...question });
  }

  async facts(): Promise<CompanyFacts> {
    return { sections: SECTIONS, productFamilies: await this.productFamilies() };
  }

  private async productFamilies(): Promise<ReadonlyMap<string, readonly string[]>> {
    let products: readonly Product[] = [];
    try {
      if (isAuthoritative(await this.catalog.activeVersion())) {
        products = (await this.catalog.listProducts({ limit: 50 })).items.filter(isAnswerable);
      }
    } catch (error) {
      if (!(error instanceof CatalogUnavailableError)) throw error;
    }
    const byFamily = new Map<string, string[]>();
    for (const p of products) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p.name]);
    return byFamily;
  }
}
