/**
 * Implementasi MySQL dari `CatalogRepository`.
 *
 * Satu aturan membentuk seluruh berkas ini: **jumlah query tidak boleh tumbuh
 * mengikuti jumlah produk.** Membaca ukuran dan spesifikasi per produk adalah
 * N+1 klasik, dan pada drawer produk maupun daftar hasil matching ia tidak
 * terlihat sampai katalognya besar. Karena itu anak-anak baris dibaca sekali
 * dengan `IN (...)` lalu dikelompokkan di memori — dan jumlah query itu diuji
 * oleh penghitung query, bukan dipercayakan pada ingatan (docs/PERFORMANCE.md §3).
 */

import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, like, or, type SQL } from 'drizzle-orm';
import type {
  CatalogVersion,
  CompatibleFitting,
  Product,
  ProductDocument,
} from '@snouty/shared-types';
import {
  catalogVersions,
  productCompatibility,
  productDocuments,
  products,
  productSizes,
  productSpecs,
} from '../../../infrastructure/mysql/schema/catalog.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import { CATALOG_SPEC_KEY_LIST } from '../domain/catalog-spec-keys.js';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
  type CategoryCount,
  type FamilyCount,
  type ProductListPage,
  type ProductListQuery,
} from '../domain/catalog.repository.js';
import {
  toCatalogVersion,
  toCompatibleFitting,
  toProduct,
  toProducts,
  type SizeRow,
  type SpecRow,
} from './catalog.mapper.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
/** Versi katalog terbit beberapa kali setahun; 50 sudah jauh di atas kenyataan. */
const MAX_VERSIONS = 50;

/** Kolom yang dibaca; dieja agar `SELECT *` tidak diam-diam menarik kolom baru. */
const PRODUCT_COLUMNS = {
  id: products.id,
  catalogVersionId: products.catalogVersionId,
  sku: products.sku,
  name: products.name,
  family: products.family,
  category: products.category,
  description: products.description,
  status: products.status,
  sourceDocument: products.sourceDocument,
  sourcePage: products.sourcePage,
  imageUrl: products.imageUrl,
};

const VERSION_COLUMNS = {
  id: catalogVersions.id,
  label: catalogVersions.label,
  sourceDocument: catalogVersions.sourceDocument,
  kind: catalogVersions.kind,
  status: catalogVersions.status,
  effectiveFrom: catalogVersions.effectiveFrom,
  importedBy: catalogVersions.importedBy,
};

@Injectable()
export class MysqlCatalogRepository implements CatalogRepository {
  constructor(private readonly database: QueryRunner) {}

  /**
   * Unique index `uq_catalog_versions_single_active` sudah menjamin paling banyak
   * satu baris aktif, jadi `limit(1)` di sini bukan penyamaran ambiguitas.
   */
  async findActiveVersion(): Promise<CatalogVersion | null> {
    const rows = await this.database.db
      .select(VERSION_COLUMNS)
      .from(catalogVersions)
      .where(eq(catalogVersions.status, 'active'))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toCatalogVersion(row);
  }

  async findVersionById(catalogVersionId: string): Promise<CatalogVersion | null> {
    const rows = await this.database.db
      .select(VERSION_COLUMNS)
      .from(catalogVersions)
      .where(eq(catalogVersions.id, catalogVersionId))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toCatalogVersion(row);
  }

  async listVersions(limit = MAX_VERSIONS): Promise<readonly CatalogVersion[]> {
    const rows = await this.database.db
      .select(VERSION_COLUMNS)
      .from(catalogVersions)
      .orderBy(desc(catalogVersions.effectiveFrom))
      .limit(Math.min(Math.max(limit, 1), MAX_VERSIONS));

    return rows.map(toCatalogVersion);
  }

  /**
   * Tiga query, berapa pun jumlah produk di halaman: produk, lalu ukuran dan
   * spesifikasi sekaligus untuk semua id di halaman itu.
   *
   * Pagination memakai cursor atas `sku`, bukan `OFFSET`. Alasannya bukan
   * kecepatan pada katalog sebesar ini, tetapi kebenaran: `OFFSET` menggeser
   * halaman saat ada produk baru masuk, sehingga pengguna bisa melewatkan satu
   * baris tanpa pernah tahu. `uq_products_version_sku` membuat urutan ini unik,
   * jadi cursor-nya tidak pernah ambigu.
   */
  async listProducts(query: ProductListQuery): Promise<ProductListPage> {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const rows = await this.database.db
      .select(PRODUCT_COLUMNS)
      .from(products)
      .where(and(...this.listConditions(query)))
      .orderBy(asc(products.sku))
      // Satu baris lebih dari yang diminta: itu cukup untuk tahu apakah masih ada
      // lanjutannya, tanpa query COUNT terpisah.
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    if (page.length === 0) return { items: [], nextCursor: null };

    const ids = page.map((row) => row.id);
    const [sizes, specs] = await Promise.all([this.sizesFor(ids), this.specsFor(ids)]);

    return {
      items: toProducts(page, sizes, specs),
      nextCursor: hasMore ? (page[page.length - 1]?.sku ?? null) : null,
    };
  }

  async familyCounts(catalogVersionId: string): Promise<readonly FamilyCount[]> {
    const rows = await this.database.db
      .select({ family: products.family, count: count() })
      .from(products)
      .where(and(eq(products.catalogVersionId, catalogVersionId), eq(products.status, 'active')))
      .groupBy(products.family)
      .orderBy(desc(count()), asc(products.family));
    return rows.map((row) => ({ family: row.family, count: Number(row.count) }));
  }

  async productNamesInFamily(catalogVersionId: string, family: string): Promise<readonly string[]> {
    const rows = await this.database.db
      .select({ name: products.name })
      .from(products)
      .where(
        and(
          eq(products.catalogVersionId, catalogVersionId),
          eq(products.family, family),
          eq(products.status, 'active'),
        ),
      )
      .orderBy(asc(products.sku));
    return rows.map((row) => row.name);
  }

  async categoryCounts(
    catalogVersionId: string,
    family: string,
  ): Promise<readonly CategoryCount[]> {
    const rows = await this.database.db
      .select({ category: products.category, count: count() })
      .from(products)
      .where(
        and(
          eq(products.catalogVersionId, catalogVersionId),
          eq(products.family, family),
          eq(products.status, 'active'),
        ),
      )
      .groupBy(products.category)
      .orderBy(desc(count()), asc(products.category));
    return rows.map((row) => ({ category: row.category, count: Number(row.count) }));
  }

  async findProductById(catalogVersionId: string, productId: string): Promise<Product | null> {
    const rows = await this.database.db
      .select(PRODUCT_COLUMNS)
      .from(products)
      .where(and(eq(products.catalogVersionId, catalogVersionId), eq(products.id, productId)))
      .limit(1);

    const row = rows[0];
    if (row === undefined) return null;

    const [sizes, specs] = await Promise.all([this.sizesFor([row.id]), this.specsFor([row.id])]);
    return toProduct(row, sizes, specs);
  }

  /**
   * Nama fitting diambil lewat join ke `products`, bukan dengan satu query per
   * fitting — daftar di drawer produk bisa memuat beberapa baris sekaligus.
   */
  async findCompatibleFittings(productId: string): Promise<readonly CompatibleFitting[]> {
    const rows = await this.database.db
      .select({
        compatibleProductId: productCompatibility.compatibleProductId,
        name: products.name,
        kind: productCompatibility.kind,
      })
      .from(productCompatibility)
      .innerJoin(products, eq(products.id, productCompatibility.compatibleProductId))
      .where(eq(productCompatibility.productId, productId))
      .orderBy(asc(productCompatibility.kind), asc(products.name));

    return rows.map(toCompatibleFitting);
  }

  async findProductDocuments(productId: string): Promise<readonly ProductDocument[]> {
    return this.database.db
      .select({
        title: productDocuments.title,
        url: productDocuments.url,
        page: productDocuments.page,
      })
      .from(productDocuments)
      .where(eq(productDocuments.productId, productId))
      .orderBy(asc(productDocuments.title));
  }

  private listConditions(query: ProductListQuery): SQL[] {
    const conditions: SQL[] = [eq(products.catalogVersionId, query.catalogVersionId)];

    if (query.family !== undefined) conditions.push(eq(products.family, query.family));
    if (query.category !== undefined) conditions.push(eq(products.category, query.category));
    if (query.categoryIncludes !== undefined && query.categoryIncludes.trim() !== '') {
      conditions.push(like(products.category, `%${escapeLike(query.categoryIncludes.trim())}%`));
    }
    if (query.status !== undefined) conditions.push(eq(products.status, query.status));
    if (query.cursor !== undefined) conditions.push(gt(products.sku, query.cursor));

    if (query.q !== undefined && query.q.trim() !== '') {
      // LIKE, bukan indeks full-text: katalognya ratusan baris, dan full-text di
      // MySQL punya daftar stopword sendiri yang akan membuang kata seperti "AW".
      const term = `%${escapeLike(query.q.trim())}%`;
      // Keluarga ikut dicari: di katalog ERP Pralon nama pipa adalah "Pipa (Plain End) Abu AW 1/2"",
      // dan "PVC AW" hanya ada di `family` — tanpa ini "ada ukuran 3/4 PVC AW?" menjawab "tidak ada".
      const match = or(
        like(products.name, term),
        like(products.sku, term),
        like(products.family, term),
      );
      if (match !== undefined) conditions.push(match);
    }

    if (query.size !== undefined) {
      // Subquery, bukan join: join ke `product_sizes` akan menggandakan baris
      // produk dan membuat `LIMIT` menghitung ukuran, bukan produk.
      const havingSize = this.database.db
        .select({ productId: productSizes.productId })
        .from(productSizes)
        .where(
          and(
            // Satuan ikut dicocokkan: `2"` tidak pernah menemukan produk `50 mm` (tanpa konversi).
            eq(productSizes.sizeUnit, query.size.unit),
            eq(productSizes.sizeValue, query.size.valueX1000),
            eq(productSizes.available, 1),
          ),
        );
      conditions.push(inArray(products.id, havingSize));
    }

    return conditions;
  }

  /** Hanya ukuran yang tersedia; terurut menaik atas nilai numerik, bukan atas label. */
  private async sizesFor(productIds: readonly string[]): Promise<SizeRow[]> {
    return this.database.db
      .select({ productId: productSizes.productId, sizeLabel: productSizes.sizeLabel })
      .from(productSizes)
      .where(and(inArray(productSizes.productId, [...productIds]), eq(productSizes.available, 1)))
      .orderBy(
        asc(productSizes.productId),
        asc(productSizes.sizeUnit),
        asc(productSizes.sizeValue),
      );
  }

  private async specsFor(productIds: readonly string[]): Promise<SpecRow[]> {
    return this.database.db
      .select({
        productId: productSpecs.productId,
        specKey: productSpecs.specKey,
        specValue: productSpecs.specValue,
        provenance: productSpecs.provenance,
        sourceDocument: productSpecs.sourceDocument,
        sourcePage: productSpecs.sourcePage,
      })
      .from(productSpecs)
      .where(
        and(
          inArray(productSpecs.productId, [...productIds]),
          inArray(productSpecs.specKey, [...CATALOG_SPEC_KEY_LIST]),
        ),
      );
  }
}

/** `%` dan `_` dari pengguna adalah karakter literal, bukan wildcard. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Factory untuk DI Nest — repository-nya sendiri hanya bergantung pada `QueryRunner`. */
export const catalogRepositoryProvider = {
  provide: CATALOG_REPOSITORY,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): CatalogRepository =>
    new MysqlCatalogRepository(database),
};
