/**
 * P1-08a — **field spesifikasi null dikembalikan sebagai `UNAVAILABLE`, bukan
 * dihilangkan.**
 *
 * Diuji pada hasil `JSON.stringify`, bukan pada objeknya, karena di situlah
 * kegagalannya akan terjadi: `JSON.stringify` membuang properti bernilai
 * `undefined` dan mempertahankan yang bernilai `null`. Memeriksa objek saja akan
 * meloloskan bentuk yang sesungguhnya sudah hilang di kabel.
 */
import { describe, expect, it } from 'vitest';
import type { CompatibleFitting, Product } from '@snouty/shared-types';
import { PipeSize } from '@snouty/shared-types';
import type { PublicProductListQuery } from '../application/catalog-query.service.js';
import { CatalogQueryService } from '../application/catalog-query.service.js';
import { InvalidCatalogQueryError } from '../domain/catalog.errors.js';
import type { ProductListPage } from '../domain/catalog.repository.js';
import { CatalogController } from './catalog.controller.js';

const PRODUCT_ID = 'P1234567890123456789012345'.slice(0, 26);

const UNAVAILABLE = { value: null, provenance: 'UNAVAILABLE' } as const;

const PRODUCT: Product = {
  id: PRODUCT_ID,
  sku: 'AW-A',
  name: 'Pralon PVC AW',
  family: 'PVC AW',
  category: 'PIPA AIR BERSIH · SNI',
  description: '',
  status: 'active',
  sizes: ['3/4"', '1"'],
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

class FakeCatalog {
  lastListQuery: PublicProductListQuery | null = null;

  async activeVersion() {
    return { id: 'VERSION', label: 'v2.4' };
  }

  async listProducts(query: PublicProductListQuery): Promise<ProductListPage> {
    this.lastListQuery = query;
    return { items: [PRODUCT], nextCursor: null };
  }

  async findProduct(): Promise<Product> {
    return PRODUCT;
  }

  async findCompatibleFittings(): Promise<readonly CompatibleFitting[]> {
    return [{ productId: 'FITTING', name: 'Tee PVC AW 3/4"', kind: 'tee' }];
  }
}

function controllerWith(fake: FakeCatalog): CatalogController {
  return new CatalogController(fake as unknown as CatalogQueryService);
}

describe('GET /products/:id — invarian P1-08a', () => {
  it('mempertahankan field spesifikasi kosong sebagai UNAVAILABLE setelah serialisasi JSON', async () => {
    const response = await controllerWith(new FakeCatalog()).findProduct({ id: PRODUCT_ID });

    const wire = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

    expect(wire['pressureClass']).toEqual({ value: null, provenance: 'UNAVAILABLE' });
    expect(wire['rodLength']).toEqual({ value: null, provenance: 'UNAVAILABLE' });
  });

  it('tidak menghilangkan satu pun dari keenam field spesifikasi', async () => {
    const response = await controllerWith(new FakeCatalog()).findProduct({ id: PRODUCT_ID });
    const wire = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

    for (const field of [
      'material',
      'standard',
      'pressureClass',
      'rodLength',
      'jointType',
      'application',
    ]) {
      expect(wire).toHaveProperty(field);
    }
  });

  it('membedakan nilai terisi dari nilai yang tidak tersedia', async () => {
    const response = await controllerWith(new FakeCatalog()).findProduct({ id: PRODUCT_ID });
    const wire = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

    expect(wire['material']).toEqual({ value: 'uPVC', provenance: 'VERIFIED' });
  });

  it('mempertahankan imageUrl null — placeholder bergaris, bukan field yang hilang', async () => {
    const response = await controllerWith(new FakeCatalog()).findProduct({ id: PRODUCT_ID });
    const wire = JSON.parse(JSON.stringify(response)) as Record<string, unknown>;

    expect(wire).toHaveProperty('imageUrl');
    expect(wire['imageUrl']).toBeNull();
  });

  it('menolak id yang bukan ULID 26 karakter', async () => {
    await expect(controllerWith(new FakeCatalog()).findProduct({ id: 'pendek' })).rejects.toThrow(
      InvalidCatalogQueryError,
    );
  });
});

describe('GET /products — penguraian parameter', () => {
  it('meneruskan filter yang dikenal apa adanya', async () => {
    const fake = new FakeCatalog();

    await controllerWith(fake).listProducts({ family: 'PVC AW', limit: '10' });

    expect(fake.lastListQuery).toEqual({ family: 'PVC AW', limit: 10 });
  });

  it('menolak parameter yang tidak dikenal, tidak mengabaikannya', async () => {
    // Mengabaikan field asing terasa ramah sampai ada satu yang kebetulan berfungsi.
    await expect(
      controllerWith(new FakeCatalog()).listProducts({ catalogVersionId: 'DRAFT' }),
    ).rejects.toThrow(InvalidCatalogQueryError);
  });

  it('menolak limit di luar batas', async () => {
    await expect(controllerWith(new FakeCatalog()).listProducts({ limit: '500' })).rejects.toThrow(
      InvalidCatalogQueryError,
    );
  });

  it('mengubah ukuran yang ditulis bebas menjadi PipeSize kanonik', async () => {
    const decimal = new FakeCatalog();
    const fraction = new FakeCatalog();

    await controllerWith(decimal).listProducts({ size: '1.25' });
    await controllerWith(fraction).listProducts({ size: '1¼"' });

    expect(decimal.lastListQuery?.size).toBeInstanceOf(PipeSize);
    expect(decimal.lastListQuery?.size?.inches).toBe(fraction.lastListQuery?.size?.inches);
  });

  it('menolak ukuran yang tidak terbaca, tidak membulatkannya ke yang terdekat', async () => {
    await expect(
      controllerWith(new FakeCatalog()).listProducts({ size: 'dua inci' }),
    ).rejects.toThrow(InvalidCatalogQueryError);
  });

  it('menyebut field yang bermasalah di details, bukan pesan zod mentah', async () => {
    try {
      await controllerWith(new FakeCatalog()).listProducts({ limit: 'banyak' });
      throw new Error('seharusnya ditolak');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidCatalogQueryError);
      expect((error as InvalidCatalogQueryError).details).toEqual({ fields: ['limit'] });
      expect((error as InvalidCatalogQueryError).message).toBe('Ada isian yang belum sesuai.');
    }
  });
});

describe('GET /products/:id/compatible', () => {
  it('membungkus hasilnya dalam { items } supaya bentuk respons bisa tumbuh', async () => {
    const response = await controllerWith(new FakeCatalog()).findCompatibleFittings({
      id: PRODUCT_ID,
    });

    expect(response).toEqual({
      items: [{ productId: 'FITTING', name: 'Tee PVC AW 3/4"', kind: 'tee' }],
    });
  });
});
