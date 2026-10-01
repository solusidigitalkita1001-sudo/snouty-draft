/**
 * P1-08 — perilaku pembacaan katalog, tanpa MySQL dan tanpa Redis.
 *
 * Dua tes yang paling penting di sini sulit dibuktikan di tempat lain: pembacaan
 * selalu terikat versi aktif, dan permintaan tetap berhasil saat Redis mati.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogVersion, CompatibleFitting, Product } from '@snouty/shared-types';
import type { CatalogCache } from '../domain/catalog-cache.port.js';
import { CatalogUnavailableError, ProductNotFoundError } from '../domain/catalog.errors.js';
import type {
  CatalogRepository,
  ProductListPage,
  ProductListQuery,
} from '../domain/catalog.repository.js';
import { CatalogQueryService } from './catalog-query.service.js';

const ACTIVE_VERSION: CatalogVersion = {
  id: 'VERSION',
  label: 'v2.4',
  sourceDocument: 'Katalog produk Pralon 2026',
  status: 'active',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  importedBy: 'ADMIN',
};

const UNAVAILABLE = { value: null, provenance: 'UNAVAILABLE' } as const;

const PRODUCT: Product = {
  id: 'PRODUCT',
  sku: 'AW-A',
  name: 'Pralon PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: '',
  status: 'active',
  sizes: ['3/4"'],
  material: { value: 'uPVC', provenance: 'VERIFIED' },
  standard: UNAVAILABLE,
  pressureClass: UNAVAILABLE,
  rodLength: UNAVAILABLE,
  jointType: UNAVAILABLE,
  application: UNAVAILABLE,
  sourceDocument: 'Katalog produk Pralon 2026',
  sourcePage: 14,
  catalogVersionId: 'VERSION',
  imageUrl: null,
};

class FakeRepository implements CatalogRepository {
  readonly calls: string[] = [];
  lastListQuery: ProductListQuery | null = null;

  constructor(
    private readonly version: CatalogVersion | null,
    private readonly product: Product | null = PRODUCT,
  ) {}

  async findActiveVersion(): Promise<CatalogVersion | null> {
    this.calls.push('findActiveVersion');
    return this.version;
  }

  async findVersionById(): Promise<CatalogVersion | null> {
    return this.version;
  }

  async listVersions(): Promise<readonly CatalogVersion[]> {
    // Hanya back-office yang mendaftar versi; jalur publik tidak boleh melihat draft.
    throw new Error('listVersions tidak dipakai jalur pembacaan publik');
  }

  async listProducts(query: ProductListQuery): Promise<ProductListPage> {
    this.calls.push('listProducts');
    this.lastListQuery = query;
    return { items: this.product === null ? [] : [this.product], nextCursor: null };
  }

  async findProductById(): Promise<Product | null> {
    this.calls.push('findProductById');
    return this.product;
  }

  async findCompatibleFittings(): Promise<readonly CompatibleFitting[]> {
    this.calls.push('findCompatibleFittings');
    return [{ productId: 'FITTING', name: 'Tee PVC AW', kind: 'tee' }];
  }
}

class MemoryCache implements CatalogCache {
  readonly entries = new Map<string, unknown>();
  readonly calls: string[] = [];

  async read<T>(key: string): Promise<T | null> {
    this.calls.push(`read:${key}`);
    return (this.entries.get(key) as T | undefined) ?? null;
  }

  async write(key: string, value: unknown): Promise<void> {
    this.calls.push(`write:${key}`);
    this.entries.set(key, value);
  }

  async invalidateAll(): Promise<number> {
    const removed = this.entries.size;
    this.entries.clear();
    return removed;
  }
}

/** Redis yang mati: setiap perintah melempar, bukan mengembalikan kosong. */
class BrokenCache implements CatalogCache {
  async read<T>(): Promise<T | null> {
    throw new Error('ECONNREFUSED 127.0.0.1:6380');
  }
  async write(): Promise<void> {
    throw new Error('ECONNREFUSED 127.0.0.1:6380');
  }
  async invalidateAll(): Promise<number> {
    throw new Error('ECONNREFUSED 127.0.0.1:6380');
  }
}

describe('CatalogQueryService — katalog belum tersedia', () => {
  it('melempar CATALOG_UNAVAILABLE saat belum ada versi aktif', async () => {
    const service = new CatalogQueryService(new FakeRepository(null), new MemoryCache());

    await expect(service.activeVersion()).rejects.toThrow(CatalogUnavailableError);
  });

  it('melaporkan hal yang sama saat daftar produk diminta', async () => {
    // Satu kode untuk satu keadaan: klien tidak perlu menebak bahwa daftar kosong
    // dan katalog yang belum ada adalah dua hal berbeda.
    const service = new CatalogQueryService(new FakeRepository(null), new MemoryCache());

    await expect(service.listProducts({})).rejects.toThrow(CatalogUnavailableError);
  });
});

describe('CatalogQueryService — selalu terikat versi aktif', () => {
  it('menyisipkan catalogVersionId versi aktif ke setiap daftar produk', async () => {
    const repository = new FakeRepository(ACTIVE_VERSION);
    const service = new CatalogQueryService(repository, new MemoryCache());

    await service.listProducts({ family: 'PVC AW' });

    expect(repository.lastListQuery?.catalogVersionId).toBe('VERSION');
    expect(repository.lastListQuery?.family).toBe('PVC AW');
  });

  it('tidak membiarkan pemanggil memilih versi katalog sendiri', async () => {
    const repository = new FakeRepository(ACTIVE_VERSION);
    const service = new CatalogQueryService(repository, new MemoryCache());

    // `catalogVersionId` memang tidak ada di tipe filter publik; ini membuktikan
    // nilai yang diselundupkan pun tetap tertimpa versi aktif.
    await service.listProducts({ catalogVersionId: 'DRAFT' } as never);

    expect(repository.lastListQuery?.catalogVersionId).toBe('VERSION');
  });

  it('mengembalikan ProductNotFound saat produknya tidak ada di versi aktif', async () => {
    const service = new CatalogQueryService(
      new FakeRepository(ACTIVE_VERSION, null),
      new MemoryCache(),
    );

    await expect(service.findProduct('PRODUCT')).rejects.toThrow(ProductNotFoundError);
  });

  it('memastikan produknya ada sebelum mengembalikan fitting sepadan', async () => {
    // Tanpa ini, id dari versi katalog lama tetap mengembalikan daftar fittingnya.
    const repository = new FakeRepository(ACTIVE_VERSION, null);
    const service = new CatalogQueryService(repository, new MemoryCache());

    await expect(service.findCompatibleFittings('PRODUCT')).rejects.toThrow(ProductNotFoundError);
    expect(repository.calls).not.toContain('findCompatibleFittings');
  });
});

describe('CatalogQueryService — cache', () => {
  it('mengisi cache setelah pembacaan pertama dan memakainya pada yang kedua', async () => {
    const repository = new FakeRepository(ACTIVE_VERSION);
    const cache = new MemoryCache();
    const service = new CatalogQueryService(repository, cache);

    await service.findProduct('PRODUCT');
    const callsAfterFirst = [...repository.calls];
    await service.findProduct('PRODUCT');

    expect(callsAfterFirst).toContain('findProductById');
    expect(repository.calls.filter((call) => call === 'findProductById')).toHaveLength(1);
  });

  it('tidak menyentuh database sama sekali saat produknya sudah di cache', async () => {
    const repository = new FakeRepository(ACTIVE_VERSION);
    const cache = new MemoryCache();
    cache.entries.set('snouty:cache:product:PRODUCT', PRODUCT);
    const service = new CatalogQueryService(repository, cache);

    const product = await service.findProduct('PRODUCT');

    expect(product).toEqual(PRODUCT);
    expect(repository.calls).toEqual([]);
  });

  it('tetap melayani permintaan saat Redis mati — cache hilang berarti lambat, bukan gagal', async () => {
    const repository = new FakeRepository(ACTIVE_VERSION);
    const service = new CatalogQueryService(repository, new BrokenCache());

    const product = await service.findProduct('PRODUCT');

    expect(product).toEqual(PRODUCT);
    expect(repository.calls).toContain('findProductById');
  });

  it('tidak men-cache daftar produk per kombinasi filter', async () => {
    // Kuncinya akan menjadi hasil kali setiap filter, dan invalidasinya harus
    // menebak kombinasi mana yang pernah ada.
    const cache = new MemoryCache();
    const service = new CatalogQueryService(new FakeRepository(ACTIVE_VERSION), cache);

    await service.listProducts({ family: 'PVC AW' });

    expect(cache.calls.filter((call) => call.startsWith('write:'))).toEqual([
      'write:snouty:cache:catalog:active',
    ]);
  });
});
