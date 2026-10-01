/**
 * P1-04a — tes integrasi repository katalog terhadap MySQL sekali pakai.
 *
 * Yang diuji di sini sengaja hal-hal yang mock tidak bisa jawab: urutan ukuran
 * atas nilai numerik, isolasi antar versi katalog, perlakuan `%` dari pengguna,
 * dan **jumlah query yang benar-benar dikirim**.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PipeSize } from '@snouty/shared-types';
import {
  catalogVersions,
  productCompatibility,
  products,
  productSizes,
  productSpecs,
} from '../../../infrastructure/mysql/schema/catalog.js';
import { createTestDatabase, testId, type TestDatabase } from '../../../../test/mysql.js';
import { MysqlCatalogRepository } from './catalog.mysql.repository.js';

const V_ACTIVE = testId('VA');
const V_DRAFT = testId('VD');
const ADMIN = testId('ADMIN');
const SOURCE = 'Katalog produk Pralon 2026';
const EFFECTIVE_FROM = new Date('2026-01-01T00:00:00.000Z');

let fixture: TestDatabase;
let repository: MysqlCatalogRepository;

beforeAll(async () => {
  fixture = await createTestDatabase('catalog');
  repository = new MysqlCatalogRepository({ db: fixture.db });
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  await fixture.clear();
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

function product(id: string, sku: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    catalogVersionId: V_ACTIVE,
    sku,
    name: `Pralon PVC AW ${sku}`,
    family: 'PVC AW',
    category: 'PIPA AIR BERSIH · SNI',
    sourceDocument: SOURCE,
    sourcePage: 14,
    ...overrides,
  };
}

/** Ukuran disimpan sebagai inci × 1000; label-nya penulisan kanonik PipeSize. */
function size(productId: string, inches: string, available = 1) {
  const parsed = PipeSize.parse(inches);
  if (parsed === null) throw new Error(`ukuran tes tidak terbaca: ${inches}`);
  return {
    productId,
    sizeInches: Math.round(parsed.inches * 1000),
    sizeLabel: parsed.label,
    available,
  };
}

async function seedVersions(): Promise<void> {
  await fixture.db
    .insert(catalogVersions)
    .values([version(V_ACTIVE, 'v2.4', 'active'), version(V_DRAFT, 'v2.5', 'draft')]);
}

describe('MysqlCatalogRepository — versi katalog', () => {
  it('mengembalikan versi aktif dan mengabaikan draft', async () => {
    await seedVersions();

    const active = await repository.findActiveVersion();

    expect(active).toEqual({
      id: V_ACTIVE,
      label: 'v2.4',
      sourceDocument: SOURCE,
      status: 'active',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      importedBy: ADMIN,
    });
  });

  it('mengembalikan null saat katalog belum pernah dipromosikan', async () => {
    await fixture.db.insert(catalogVersions).values([version(V_DRAFT, 'v2.5', 'draft')]);

    expect(await repository.findActiveVersion()).toBeNull();
  });

  it('menemukan versi berdasarkan id, apa pun statusnya', async () => {
    await seedVersions();

    const draft = await repository.findVersionById(V_DRAFT);

    expect(draft?.status).toBe('draft');
  });
});

describe('MysqlCatalogRepository — daftar produk', () => {
  it('hanya mengembalikan produk dari versi katalog yang diminta', async () => {
    await seedVersions();
    await fixture.db
      .insert(products)
      .values([
        product(testId('PA'), 'AW-A'),
        product(testId('PB'), 'AW-B', { catalogVersionId: V_DRAFT }),
      ]);

    const page = await repository.listProducts({ catalogVersionId: V_ACTIVE });

    expect(page.items.map((p) => p.sku)).toEqual(['AW-A']);
  });

  it('mengurutkan ukuran atas nilai numerik, bukan atas label', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A')]);
    // Disisipkan dalam urutan acak: kalau pengurutannya atas string,
    // `1¼"` akan mendahului `1"` dan `3/4"` akan berada di akhir.
    await fixture.db
      .insert(productSizes)
      .values([size(id, '1 1/4'), size(id, '3/4'), size(id, '1')]);

    const page = await repository.listProducts({ catalogVersionId: V_ACTIVE });

    expect(page.items[0]?.sizes).toEqual(['3/4"', '1"', '1¼"']);
  });

  it('tidak mengembalikan ukuran yang ditandai tidak tersedia', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A')]);
    await fixture.db.insert(productSizes).values([size(id, '3/4'), size(id, '1', 0)]);

    const page = await repository.listProducts({ catalogVersionId: V_ACTIVE });

    expect(page.items[0]?.sizes).toEqual(['3/4"']);
  });

  it('menyaring ukuran atas nilai numerik: 1.25" dan 1¼" adalah ukuran yang sama', async () => {
    await seedVersions();
    const matching = testId('PA');
    const other = testId('PB');
    await fixture.db.insert(products).values([product(matching, 'AW-A'), product(other, 'AW-B')]);
    await fixture.db.insert(productSizes).values([size(matching, '1 1/4'), size(other, '3/4')]);

    const asDecimal = await repository.listProducts({
      catalogVersionId: V_ACTIVE,
      size: PipeSize.parse('1.25')!,
    });
    const asFraction = await repository.listProducts({
      catalogVersionId: V_ACTIVE,
      size: PipeSize.parse('1¼')!,
    });

    expect(asDecimal.items.map((p) => p.sku)).toEqual(['AW-A']);
    expect(asFraction.items.map((p) => p.sku)).toEqual(['AW-A']);
  });

  it('memperlakukan % dari pengguna sebagai karakter literal, bukan wildcard', async () => {
    await seedVersions();
    await fixture.db
      .insert(products)
      .values([
        product(testId('PA'), 'AW-A', { name: 'Pralon 100% PVC' }),
        product(testId('PB'), 'AW-B', { name: 'Pralon PVC AW' }),
      ]);

    const page = await repository.listProducts({ catalogVersionId: V_ACTIVE, q: '%' });

    expect(page.items.map((p) => p.name)).toEqual(['Pralon 100% PVC']);
  });

  it('melanjutkan halaman lewat cursor tanpa mengulang atau melewatkan baris', async () => {
    await seedVersions();
    await fixture.db
      .insert(products)
      .values([
        product(testId('PA'), 'AW-A'),
        product(testId('PB'), 'AW-B'),
        product(testId('PC'), 'AW-C'),
      ]);

    const first = await repository.listProducts({ catalogVersionId: V_ACTIVE, limit: 2 });
    const second = await repository.listProducts({
      catalogVersionId: V_ACTIVE,
      limit: 2,
      cursor: first.nextCursor!,
    });

    expect(first.items.map((p) => p.sku)).toEqual(['AW-A', 'AW-B']);
    expect(first.nextCursor).toBe('AW-B');
    expect(second.items.map((p) => p.sku)).toEqual(['AW-C']);
    expect(second.nextCursor).toBeNull();
  });

  it('memakai jumlah query yang sama untuk 1 produk dan untuk 20 produk', async () => {
    await seedVersions();
    const many = Array.from({ length: 20 }, (_, i) => {
      const id = testId(`P${String(i).padStart(2, '0')}`);
      return { id, sku: `AW-${String(i).padStart(2, '0')}` };
    });
    await fixture.db.insert(products).values(many.map((p) => product(p.id, p.sku)));
    await fixture.db.insert(productSizes).values(many.map((p) => size(p.id, '3/4')));
    await fixture.db.insert(productSpecs).values(
      many.map((p) => ({
        productId: p.id,
        specKey: 'material',
        specValue: 'PVC',
        provenance: 'VERIFIED',
      })),
    );

    fixture.counter.reset();
    const one = await repository.listProducts({ catalogVersionId: V_ACTIVE, limit: 1 });
    const queriesForOne = fixture.counter.count;

    fixture.counter.reset();
    const all = await repository.listProducts({ catalogVersionId: V_ACTIVE, limit: 20 });
    const queriesForTwenty = fixture.counter.count;

    expect(one.items).toHaveLength(1);
    expect(all.items).toHaveLength(20);
    // Produk, ukuran, spesifikasi — tiga query, berapa pun jumlah barisnya.
    expect(queriesForOne).toBe(3);
    expect(queriesForTwenty).toBe(3);
  });

  it('tidak mengirim query anak sama sekali saat tidak ada produk yang cocok', async () => {
    await seedVersions();

    fixture.counter.reset();
    const page = await repository.listProducts({ catalogVersionId: V_ACTIVE });

    expect(page.items).toEqual([]);
    expect(fixture.counter.count).toBe(1);
  });
});

describe('MysqlCatalogRepository — spesifikasi dan provenance', () => {
  it('mengembalikan spesifikasi yang tidak punya baris sebagai UNAVAILABLE, bukan menghilangkannya', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A')]);

    const found = await repository.findProductById(V_ACTIVE, id);

    expect(found?.pressureClass).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(found).toHaveProperty('rodLength');
  });

  it('tidak pernah membocorkan nilai dari baris spesifikasi bertanda UNAVAILABLE', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A')]);
    await fixture.db.insert(productSpecs).values([
      {
        productId: id,
        specKey: 'pressure_class',
        specValue: 'mungkin 10 bar',
        provenance: 'UNAVAILABLE',
      },
    ]);

    const found = await repository.findProductById(V_ACTIVE, id);

    expect(found?.pressureClass).toEqual({ value: null, provenance: 'UNAVAILABLE' });
  });

  it('membawa dokumen dan halaman sumber untuk spesifikasi VERIFIED', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A')]);
    await fixture.db.insert(productSpecs).values([
      {
        productId: id,
        specKey: 'material',
        specValue: 'PVC',
        provenance: 'VERIFIED',
        sourceDocument: SOURCE,
        sourcePage: 14,
      },
    ]);

    const found = await repository.findProductById(V_ACTIVE, id);

    expect(found?.material).toEqual({
      value: 'PVC',
      provenance: 'VERIFIED',
      sourceDocument: SOURCE,
      sourcePage: 14,
    });
  });
});

describe('MysqlCatalogRepository — produk tunggal dan fitting', () => {
  it('tidak mengembalikan produk bila id-nya milik versi katalog lain', async () => {
    await seedVersions();
    const id = testId('PA');
    await fixture.db.insert(products).values([product(id, 'AW-A', { catalogVersionId: V_DRAFT })]);

    expect(await repository.findProductById(V_ACTIVE, id)).toBeNull();
  });

  it('membaca nama fitting sepadan lewat satu query, bukan satu query per fitting', async () => {
    await seedVersions();
    const pipe = testId('PA');
    const tee = testId('FT');
    const elbow = testId('FE');
    await fixture.db
      .insert(products)
      .values([
        product(pipe, 'AW-A'),
        product(tee, 'FIT-T', { name: 'Tee PVC AW 3/4"' }),
        product(elbow, 'FIT-E', { name: 'Elbow PVC AW 3/4"' }),
      ]);
    await fixture.db.insert(productCompatibility).values([
      { productId: pipe, compatibleProductId: tee, kind: 'tee' },
      { productId: pipe, compatibleProductId: elbow, kind: 'elbow' },
    ]);

    fixture.counter.reset();
    const fittings = await repository.findCompatibleFittings(pipe);

    expect(fittings).toEqual([
      { productId: elbow, name: 'Elbow PVC AW 3/4"', kind: 'elbow' },
      { productId: tee, name: 'Tee PVC AW 3/4"', kind: 'tee' },
    ]);
    expect(fixture.counter.count).toBe(1);
  });
});
