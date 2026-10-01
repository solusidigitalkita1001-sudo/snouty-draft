/**
 * P1-08a ujung-ke-ujung — terhadap MySQL **dan** Redis sungguhan.
 *
 * Spesifikasi kosong di sini benar-benar tidak punya baris di `product_specs`,
 * bukan `null` yang disiapkan fixture. Itu bedanya: tes dengan mock membuktikan
 * mapper mengisi field yang hilang; tes ini membuktikan bahwa pada katalog yang
 * memang tidak memuat "tekanan kerja", UI tetap menerima `UNAVAILABLE` dan bukan
 * field yang hilang.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  catalogVersions,
  products,
  productSpecs,
} from '../../../infrastructure/mysql/schema/catalog.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { createTestRedis, type TestRedis } from '../../../../test/redis.js';
import { CatalogPromotionService } from '../application/catalog-promotion.service.js';
import { CatalogQueryService } from '../application/catalog-query.service.js';
import { catalogProductKey } from '../domain/catalog-cache.port.js';
import { CatalogUnavailableError, ProductNotFoundError } from '../domain/catalog.errors.js';
import { MysqlCatalogRepository } from './catalog.mysql.repository.js';
import { MysqlCatalogWriter } from './catalog.mysql.writer.js';
import { RedisCatalogCache } from './catalog.redis.cache.js';

const V_ACTIVE = testId('VACT');
const V_DRAFT = testId('VDRAFT');
const PIPE = testId('PIPE');
const DRAFT_PRODUCT = testId('PDRAFT');
const ADMIN = testId('ADMIN');
const SOURCE = 'Katalog produk Pralon 2026';
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

let fixture: TestDatabase;
let redis: TestRedis;
let query: CatalogQueryService;
let promotion: CatalogPromotionService;

beforeAll(async () => {
  fixture = await createTestDatabase('query');
  redis = await createTestRedis(2);
  const repository = new MysqlCatalogRepository({ db: fixture.db });
  const cache = new RedisCatalogCache(redis.client);
  query = new CatalogQueryService(repository, cache);
  promotion = new CatalogPromotionService(
    repository,
    new MysqlCatalogWriter({ db: fixture.db }),
    cache,
  );
});

afterAll(async () => {
  await fixture.close();
  await redis.close();
});

beforeEach(async () => {
  await fixture.clear();
  await redis.clear();
});

function version(id: string, label: string, status: 'draft' | 'active') {
  return {
    id,
    label,
    sourceDocument: SOURCE,
    status,
    effectiveFrom: EFFECTIVE_FROM,
    importedBy: ADMIN,
  };
}

function product(id: string, catalogVersionId: string, sku: string) {
  return {
    id,
    catalogVersionId,
    sku,
    name: `Pralon PVC AW ${sku}`,
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    sourceDocument: SOURCE,
    sourcePage: 14,
    rowHash: sku.toLowerCase().padEnd(64, '0'),
  };
}

/** Katalog yang memuat `material` tetapi TIDAK memuat tekanan kerja — kasus desain. */
async function seedActiveCatalog(): Promise<void> {
  await fixture.db
    .insert(catalogVersions)
    .values([version(V_ACTIVE, 'v2.4', 'active'), version(V_DRAFT, 'v2.5', 'draft')]);
  await fixture.db
    .insert(products)
    .values([product(PIPE, V_ACTIVE, 'AW-A'), product(DRAFT_PRODUCT, V_DRAFT, 'AW-B')]);
  await fixture.db
    .insert(productSpecs)
    .values([{ productId: PIPE, specKey: 'material', specValue: 'uPVC', provenance: 'VERIFIED' }]);
}

describe('pembacaan katalog — spesifikasi yang tidak ada barisnya', () => {
  it('dikembalikan sebagai UNAVAILABLE dan tetap ada setelah serialisasi JSON', async () => {
    await seedActiveCatalog();

    const found = await query.findProduct(PIPE);
    const wire = JSON.parse(JSON.stringify(found)) as Record<string, unknown>;

    expect(wire['pressureClass']).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(wire['material']).toEqual({ value: 'uPVC', provenance: 'VERIFIED' });
  });

  it('tetap UNAVAILABLE ketika jawabannya datang dari cache, bukan dari MySQL', async () => {
    // Cache menyimpan JSON. Kalau bentuknya bisa berubah di satu jalur saja, di
    // sinilah ia berubah — dan hanya pada pembacaan kedua.
    await seedActiveCatalog();

    await query.findProduct(PIPE);
    const cached = await query.findProduct(PIPE);

    expect(cached.pressureClass).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(await redis.client.exists(catalogProductKey(PIPE))).toBe(1);
  });
});

describe('pembacaan katalog — versi aktif', () => {
  it('tidak pernah mengembalikan produk dari versi draft', async () => {
    await seedActiveCatalog();

    await expect(query.findProduct(DRAFT_PRODUCT)).rejects.toThrow(ProductNotFoundError);
  });

  it('hanya mendaftar produk dari versi aktif', async () => {
    await seedActiveCatalog();

    const page = await query.listProducts({});

    expect(page.items.map((item) => item.sku)).toEqual(['AW-A']);
  });

  it('melempar CATALOG_UNAVAILABLE saat katalog belum pernah dipromosikan', async () => {
    await fixture.db.insert(catalogVersions).values([version(V_DRAFT, 'v2.5', 'draft')]);

    await expect(query.listProducts({})).rejects.toThrow(CatalogUnavailableError);
  });
});

describe('pembacaan katalog — setelah promosi versi', () => {
  it('langsung melihat katalog baru, bukan menunggu TTL habis', async () => {
    // Rantai lengkap P1-07 + P1-08: baca (mengisi cache) → promosikan
    // (menginvalidasi) → baca lagi dan dapatkan versi yang baru.
    await seedActiveCatalog();
    expect((await query.activeVersion()).label).toBe('v2.4');

    await promotion.promote({
      catalogVersionId: V_DRAFT,
      actor: { id: ADMIN, role: 'catalog_admin' },
    });

    expect((await query.activeVersion()).label).toBe('v2.5');
  });

  it('membuang produk yang di-cache dari versi lama', async () => {
    await seedActiveCatalog();
    await query.findProduct(PIPE);

    await promotion.promote({
      catalogVersionId: V_DRAFT,
      actor: { id: ADMIN, role: 'catalog_admin' },
    });

    expect(await redis.client.exists(catalogProductKey(PIPE))).toBe(0);
    await expect(query.findProduct(PIPE)).rejects.toThrow(ProductNotFoundError);
  });
});
