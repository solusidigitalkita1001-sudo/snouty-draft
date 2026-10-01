/**
 * P2-06a — setiap potongan membawa dokumen + halaman; di bawah ambang → tidak ada
 * potongan sama sekali.
 *
 * Yang diuji terakhir di berkas ini adalah yang paling mudah hilang nanti: ambang
 * skor. "Kembalikan apa pun yang paling mirip" adalah perilaku baku yang paling
 * sulit dicabut setelah ada yang bergantung padanya.
 */
import { describe, expect, it } from 'vitest';
import type { Product, ProductDocument } from '@snouty/shared-types';
import type { CatalogQueryService } from '../../product-catalog/application/catalog-query.service.js';
import { MINIMUM_RETRIEVAL_SCORE } from '../domain/knowledge-retriever.port.js';
import { PRODUCT_ASPECTS } from '../domain/product-aspect.js';
import { CatalogDocumentRetriever } from './catalog-document.retriever.js';

const PRODUCT_ID = 'P'.padEnd(26, '0');

const PRODUCT = {
  id: PRODUCT_ID,
  sourceDocument: 'Katalog produk Pralon 2026',
  sourcePage: 14,
} as unknown as Product;

function retrieverWith(documents: readonly ProductDocument[]): CatalogDocumentRetriever {
  const catalog = {
    findProduct: async () => PRODUCT,
    findProductDocuments: async () => documents,
  } as unknown as CatalogQueryService;
  return new CatalogDocumentRetriever(catalog);
}

describe('CatalogDocumentRetriever', () => {
  it('tidak mengembalikan apa pun saat produk tidak punya dokumen', async () => {
    const chunks = await retrieverWith([]).retrieve('tekanan kerja', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(chunks).toEqual([]);
  });

  it('menemukan dokumen lewat label aspek, bukan hanya lewat kalimat pengguna', async () => {
    // "Tekanan kerjanya berapa?" harus menemukan dokumen berjudul "Tekanan kerja"
    // walaupun kalimat penggunanya tidak memuat kata itu persis.
    const chunks = await retrieverWith([
      { title: 'Tekanan kerja pipa AW', url: 'https://example.invalid/a.pdf', page: 7 },
    ]).retrieve('berapa kuatnya', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.title).toBe('Tekanan kerja pipa AW');
  });

  it('membawa halaman pada setiap potongan', async () => {
    const chunks = await retrieverWith([
      { title: 'Tekanan kerja pipa AW', url: 'https://example.invalid/a.pdf', page: 7 },
    ]).retrieve('tekanan kerja', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(chunks[0]?.sourcePage).toBe(7);
    expect(chunks[0]?.sourceDocument).toBeTruthy();
  });

  it('membuang dokumen yang tidak ada hubungannya, bukan mengembalikan yang paling mirip', async () => {
    // Retrieval yang memaksakan potongan paling mirip dari korpus yang tidak relevan
    // menghasilkan jawaban percaya diri yang salah (SPEC §5 Policy 2).
    const chunks = await retrieverWith([
      { title: 'Panduan pemasangan septic tank', url: 'https://example.invalid/b.pdf', page: 2 },
    ]).retrieve('tekanan kerja', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(chunks).toEqual([]);
  });

  it('mengurutkan dari skor tertinggi', async () => {
    const chunks = await retrieverWith([
      { title: 'Katalog umum', url: 'https://example.invalid/c.pdf', page: 1 },
      { title: 'Tekanan kerja pipa AW', url: 'https://example.invalid/a.pdf', page: 7 },
    ]).retrieve('tekanan kerja pipa', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
    });

    expect(chunks[0]?.title).toBe('Tekanan kerja pipa AW');
  });

  it('menghormati batas jumlah potongan', async () => {
    const documents = Array.from({ length: 10 }, (_, i) => ({
      title: `Tekanan kerja varian ${i}`,
      url: `https://example.invalid/${i}.pdf`,
      page: i + 1,
    }));

    const chunks = await retrieverWith(documents).retrieve('tekanan kerja', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.pressureClass,
      limit: 3,
    });

    expect(chunks).toHaveLength(3);
  });

  it('menegakkan ambang yang memang ada, bukan nol', async () => {
    expect(MINIMUM_RETRIEVAL_SCORE).toBeGreaterThan(0);
  });

  it('tidak pernah mengembalikan potongan dengan skor di bawah ambang', async () => {
    const chunks = await retrieverWith([
      { title: 'Tekanan air kota', url: 'https://example.invalid/d.pdf', page: 4 },
    ]).retrieve('panjang batang sambungan material standar aplikasi', {
      productId: PRODUCT_ID,
      aspect: PRODUCT_ASPECTS.rodLength,
    });

    for (const chunk of chunks) {
      expect(chunk.score).toBeGreaterThanOrEqual(MINIMUM_RETRIEVAL_SCORE);
    }
  });
});
