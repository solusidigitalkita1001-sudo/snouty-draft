/**
 * Regresi audit 2026-10-09: pertanyaan FITTING tidak pernah dijawab dengan produk PIPA, filter
 * jenis dan ukuran memakai taksonomi katalog, dan tidak ada hasil berarti dikatakan — bukan diganti.
 */
import { PipeSize, type Product } from '@snouty/shared-types';
import { describe, expect, it } from 'vitest';
import type { PublicProductListQuery } from '../../product-catalog/application/catalog-query.service.js';
import {
  catalogScope,
  fittingAnswer,
  fittingTypeLabel,
  type ScopeCatalog,
} from './catalog-scope.js';

function product(
  sku: string,
  name: string,
  family: string,
  category: string,
  sizes: string[],
  pn: string | null = null,
): Product {
  const none = { provenance: 'UNAVAILABLE', value: null };
  return {
    id: sku.padEnd(26, '0'),
    sku,
    name,
    family,
    category,
    description: null,
    status: 'active',
    sizes,
    material: none,
    standard: none,
    pressureClass: pn ? { provenance: 'VERIFIED', value: pn } : none,
    rodLength: none,
    jointType: none,
    application: none,
    sourceDocument: null,
    sourcePage: null,
    catalogVersionId: 'V'.repeat(26),
    imageUrl: null,
  } as unknown as Product;
}

const PRODUCTS: Product[] = [
  product('P1', 'PIPA PVC AW 110 MM', 'PIPA PVC', 'PIPA · AW', ['110 mm']),
  product('P2', 'PIPA HDPE PN10 110 MM', 'PIPA HDPE', 'PIPA · HDPE', ['110 mm'], 'PN10'),
  product('F1', 'ELBOW 90 PVC 3/4"', 'FITTING PVC', 'FITTING · ELBOW 90°', ['3/4"']),
  product('F2', 'ELBOW 45 PVC 1"', 'FITTING PVC', 'FITTING · ELBOW 45°', ['1"']),
  product('F3', 'TEE PVC 1"', 'FITTING PVC', 'FITTING · TEE', ['1"']),
  product('H1', 'ELBOW HDPE 110 MM PN10', 'FITTING HDPE', 'FITTING · ELBOW', ['110 mm'], 'PN10'),
  product('H2', 'TEE HDPE 110 MM', 'FITTING HDPE', 'FITTING · TEE', ['110 mm']),
  product('H3', 'COUPLER HDPE 63 MM', 'FITTING HDPE', 'FITTING · COUPLER', ['63 mm']),
];

type Recording = ScopeCatalog & { queries: PublicProductListQuery[] };

function catalog(products: Product[] = PRODUCTS): Recording {
  const queries: PublicProductListQuery[] = [];
  const families = [...new Set(products.map((p) => p.family))];
  return {
    queries,
    activeVersion: async () => ({ status: 'active', kind: 'authoritative' }) as never,
    familyCounts: async () =>
      families.map((family) => ({
        family,
        count: products.filter((p) => p.family === family).length,
      })),
    productNamesInFamily: async (family) =>
      products.filter((p) => p.family === family).map((p) => p.name),
    categoryCounts: async (family) => {
      const counts = new Map<string, number>();
      for (const p of products.filter((x) => x.family === family)) {
        counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
      }
      return [...counts]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    },
    listProducts: async (query) => {
      queries.push(query);
      const items = products.filter(
        (p) =>
          (query.family === undefined || p.family === query.family) &&
          (query.categoryIncludes === undefined ||
            p.category.toLowerCase().includes(query.categoryIncludes.toLowerCase())) &&
          (query.size === undefined ||
            p.sizes.some((s) => PipeSize.parse(s)?.equals(query.size!) ?? false)),
      );
      return { items: items.slice(0, query.limit ?? 50), nextCursor: null };
    },
  };
}

const FAMILIES = [...new Set(PRODUCTS.map((p) => p.family))];

function ask(message: string, kindTerms: string[] = [], size: string | null = null) {
  return { message, kindTerms, size, locale: 'id' as const };
}

describe('catalog scope — fitting', () => {
  it('1. "apa bedanya fitting pvc dan fitting hdpe?" membandingkan fitting, tanpa produk pipa', async () => {
    const message = 'apa bedanya fitting pvc dan fitting hdpe?';
    const scope = catalogScope(message, null, FAMILIES);
    expect([...scope].sort()).toEqual(['FITTING HDPE', 'FITTING PVC']);
    const out = await fittingAnswer(catalog(), scope, ask(message));
    expect(out).not.toBeNull();
    expect(out!.text).not.toMatch(/PIPA/);
    expect(out!.products).toEqual([]);
    expect(out!.text).toContain('Secara umum:');
    expect(out!.text).toContain('Di katalog Pralon yang aktif:');
    expect(out!.text).toContain('FITTING PVC** — 3 SKU aktif');
    expect(out!.text).toContain('FITTING HDPE** — 3 SKU aktif');
  });

  it('2. "cari fitting elbow PVC" hanya mengembalikan elbow dari FITTING PVC', async () => {
    const cat = catalog();
    const message = 'cari fitting elbow PVC Pralon';
    const out = await fittingAnswer(
      cat,
      catalogScope(message, null, FAMILIES),
      ask(message, ['elbow']),
    );
    expect(out!.products.map((p) => p.sku).sort()).toEqual(['F1', 'F2']);
    expect(cat.queries[0]).toMatchObject({
      family: 'FITTING PVC',
      categoryIncludes: 'elbow',
      status: 'active',
    });
  });

  it('3. "cari fitting HDPE untuk pipa 110 mm" memfilter keluarga dan ukuran', async () => {
    const message = 'cari fitting HDPE untuk pipa 110 mm';
    const scope = catalogScope(message, null, FAMILIES);
    const out = await fittingAnswer(catalog(), scope, ask(message, [], '110 mm'));
    expect(out!.products.map((p) => p.sku).sort()).toEqual(['H1', 'H2']);
  });

  it('4. lanjutan "kalau ukuran 110 mm?" mewarisi keluarga subjek', async () => {
    const scope = catalogScope('kalau ukuran 110 mm?', 'fitting hdpe', FAMILIES);
    expect(scope).toEqual(['FITTING HDPE']);
    const out = await fittingAnswer(catalog(), scope, ask('kalau ukuran 110 mm?', [], '110 mm'));
    expect(out!.products.length).toBeGreaterThan(0);
    expect(out!.products.every((p) => p.family === 'FITTING HDPE')).toBe(true);
  });

  it('5. tidak ada hasil: dikatakan jujur, tidak diganti kategori atau ukuran lain', async () => {
    const out = await fittingAnswer(
      catalog(),
      ['FITTING PVC'],
      ask('elbow pvc 110 mm', ['elbow'], '110 mm'),
    );
    expect(out!.products).toEqual([]);
    expect(out!.text).toContain('belum ada');
    expect(out!.text).not.toMatch(/TEE|PIPA/);
  });

  it('6. lingkup bukan fitting dikembalikan ke jalur lama', async () => {
    const message = 'apa beda pipa PVC dan HDPE?';
    const scope = catalogScope(message, null, FAMILIES);
    expect(await fittingAnswer(catalog(), scope, ask(message))).toBeNull();
  });

  it('7. kelas tekanan hanya disebut bila tercatat di katalog', async () => {
    const out = await fittingAnswer(
      catalog(),
      ['FITTING HDPE'],
      ask('fitting hdpe 110 mm', [], '110 mm'),
    );
    expect(out!.text).toContain('ELBOW HDPE 110 MM PN10 — kelas tekanan PN10');
    expect(out!.text).toContain('- TEE HDPE 110 MM\n');
  });

  it('8. satu keluarga: jumlah dan jenis dari kategori resmi katalog', async () => {
    const out = await fittingAnswer(catalog(), ['FITTING PVC'], ask('jelaskan fitting pvc'));
    expect(out!.text).toContain('3 SKU aktif dalam 3 kategori katalog');
    expect(out!.text).toContain('**Elbow 90°** — 1 SKU');
    expect(out!.text).not.toMatch(/PIPA/);
  });

  it('label jenis dari kategori resmi', () => {
    expect(fittingTypeLabel('FITTING · ELBOW 45°')).toBe('Elbow 45°');
    expect(fittingTypeLabel('FITTING · TY')).toBe('TY');
  });
});
