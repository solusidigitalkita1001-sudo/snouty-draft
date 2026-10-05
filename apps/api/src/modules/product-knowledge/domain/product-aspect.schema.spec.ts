/**
 * Kosakata aspek di skema parse `ai` HARUS sama dengan `PRODUCT_ASPECTS` di sini.
 * `ai` tidak boleh mengimpor domain, jadi daftarnya diduplikasi — dan duplikasi adalah
 * tempat penyimpangan bersembunyi (docs/PRODUCT_KNOWLEDGE.md §4). Tes ini pagarnya.
 */
import { describe, expect, it } from 'vitest';
import { ProductQuestionSchema } from '../../ai/domain/extraction-schema.js';
import { PRODUCT_ASPECT_LIST } from './product-aspect.js';

describe('kosakata aspek pertanyaan produk', () => {
  it('skema parse ai dan PRODUCT_ASPECTS memuat label yang persis sama', () => {
    const fromAi = ProductQuestionSchema.shape.aspect.unwrap().options;
    expect([...fromAi].sort()).toEqual([...PRODUCT_ASPECT_LIST].sort());
  });
});
