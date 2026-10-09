/**
 * Hitungan katalog terhadap MySQL SUNGGUHAN (audit anti-halusinasi 2026-10-09).
 *
 * Kasus produksi: "Produk Pralon HDPE ada berapa varian?" dijawab 1.327 — jumlah baris SKU,
 * termasuk satu salinan ERP "(copy)". Yang dibuktikan di sini: hitungan SQL sama dengan aturan
 * identitas produk di kode (`distinctProductNames`), produk nonaktif dan versi draft tidak ikut,
 * keluarga lain tidak tercampur, dan nama per keluarga yang dibaca layanan sejalan dengan hitungan.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { catalogVersions, products } from '../../../infrastructure/mysql/schema/catalog.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { createTestRedis, type TestRedis } from '../../../../test/redis.js';
import { CatalogQueryService } from '../application/catalog-query.service.js';
import { distinctProductNames } from '../domain/product-identity.js';
import { MysqlCatalogRepository } from './catalog.mysql.repository.js';
import { RedisCatalogCache } from './catalog.redis.cache.js';

const V_ACTIVE = testId('CVACT');
const V_DRAFT = testId('CVDRAFT');

let fixture: TestDatabase;
let redis: TestRedis;
let repository: MysqlCatalogRepository;
let query: CatalogQueryService;

beforeAll(async () => {
  fixture = await createTestDatabase('counts');
  redis = await createTestRedis(3);
  repository = new MysqlCatalogRepository({ db: fixture.db });
  query = new CatalogQueryService(repository, new RedisCatalogCache(redis.client));
});

afterAll(async () => {
  await fixture.close();
  await redis.close();
});

beforeEach(async () => {
  await fixture.clear();
  await redis.clear();
});

let seq = 0;
function row(
  catalogVersionId: string,
  family: string,
  name: string,
  status: 'active' | 'discontinued' = 'active',
) {
  seq += 1;
  const sku = `SKU-${String(seq).padStart(4, '0')}`;
  return {
    id: testId(`PR${String(seq).padStart(4, '0')}`),
    catalogVersionId,
    sku,
    name,
    family,
    category: family.startsWith('FITTING') ? 'FITTING' : `PIPA ${family}`,
    status,
    sourceDocument: 'Export ERP uji',
    sourcePage: 1,
    rowHash: sku.toLowerCase().padEnd(64, '0'),
  };
}

const HDPE_ACTIVE = [
  'Pipa HDPE PE 100 PN-8 160 mm x 6 Meter',
  'Pipa HDPE PE 100 PN-12,5 160 mm x 6 Meter',
  'Pipa HDPE Gas SDR-13.6 50 mm x 100 Meter Kuning',
  // Salinan ERP dari baris di atas: koma desimal + tanda "(copy)" — produk yang sama.
  'Pipa HDPE Gas SDR-13,6 50 mm x 100 Meter Kuning (copy)',
  'Pipa HDPE PN-4 900 mm x 6 Meter',
];

async function seed(): Promise<void> {
  await fixture.db.insert(catalogVersions).values([
    {
      id: V_ACTIVE,
      label: 'erp-uji',
      sourceDocument: 'Export ERP uji',
      status: 'active',
      effectiveFrom: new Date('2026-10-06T00:00:00.000Z'),
      importedBy: testId('ADM'),
    },
    {
      id: V_DRAFT,
      label: 'erp-uji-draft',
      sourceDocument: 'Export ERP uji',
      status: 'draft',
      effectiveFrom: new Date('2026-10-07T00:00:00.000Z'),
      importedBy: testId('ADM'),
    },
  ]);
  await fixture.db
    .insert(products)
    .values([
      ...HDPE_ACTIVE.map((n) => row(V_ACTIVE, 'HDPE', n)),
      row(V_ACTIVE, 'HDPE', 'Pipa HDPE PE 100 PN-20 16 mm x 100 Meter', 'discontinued'),
      row(V_DRAFT, 'HDPE', 'Pipa HDPE PE 100 PN-25 1000 mm x 6 Meter'),
      row(V_ACTIVE, 'MDPE', 'Pipa MDPE SDR-11 110 mm x 100 Meter Kuning'),
      row(V_ACTIVE, 'FITTING PVC', 'Spigot All Flange - D 110 x 63 mm'),
      row(V_ACTIVE, 'FITTING PVC', 'Spigot All Flange - D 110 x 63 mm'),
    ]);
}

describe('familyCounts — produk berbeda, bukan baris', () => {
  it('jumlah HDPE sama dengan aturan identitas di kode; SKU tetap dilaporkan', async () => {
    await seed();
    const counts = await repository.familyCounts(V_ACTIVE);
    const hdpe = counts.find((c) => c.family === 'HDPE')!;
    expect(hdpe.count).toBe(distinctProductNames(HDPE_ACTIVE).length);
    expect(hdpe).toEqual({ family: 'HDPE', count: 4, skuCount: 5 });
  });

  it('produk nonaktif dan versi draft tidak dihitung; keluarga lain tidak tercampur', async () => {
    await seed();
    const counts = await repository.familyCounts(V_ACTIVE);
    expect(counts.map((c) => c.family).sort()).toEqual(['FITTING PVC', 'HDPE', 'MDPE']);
    expect(counts.find((c) => c.family === 'MDPE')).toEqual({
      family: 'MDPE',
      count: 1,
      skuCount: 1,
    });
    // Dua SKU bernama persis sama: satu produk, dua SKU.
    expect(counts.find((c) => c.family === 'FITTING PVC')).toEqual({
      family: 'FITTING PVC',
      count: 1,
      skuCount: 2,
    });
  });

  it('nama per keluarga dari layanan sejalan dengan hitungan; ukuran hanya dari keluarga itu', async () => {
    await seed();
    const names = await query.productNamesInFamily('HDPE');
    expect(names).toHaveLength(4);
    expect(names.some((n) => n.includes('(copy)'))).toBe(false);
    expect(names.some((n) => n.includes('MDPE') || n.includes('1000 mm'))).toBe(false);
    expect(names.some((n) => n.includes('16 mm'))).toBe(false); // nonaktif
  });

  it('hitungan per kategori memakai aturan yang sama', async () => {
    await seed();
    expect(await repository.categoryCounts(V_ACTIVE, 'FITTING PVC')).toEqual([
      { category: 'FITTING', count: 1 },
    ]);
  });
});
