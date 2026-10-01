/**
 * Pembacaan katalog untuk API publik. Layar 10 (drawer detail produk) membaca
 * dari sini, begitu juga matcher nanti.
 *
 * Dua hal yang dijaga di lapisan ini, dan bukan di repository maupun di controller:
 *
 * **Setiap pembacaan terikat versi aktif.** Pemanggil tidak pernah memilih versi
 * katalog sendiri. Kalau boleh, cepat atau lambat ada jalur yang membaca versi
 * `draft` yang belum ditinjau siapa pun, dan produk yang belum disetujui akan
 * muncul sebagai kartu.
 *
 * **Redis boleh mati tanpa menjatuhkan permintaan.** Redis adalah cache, bukan
 * sumber kebenaran (SPEC §18), jadi kegagalannya berarti kehilangan kecepatan —
 * bukan kehilangan jawaban. Keputusan itu ada di sini, di tempat yang bisa diuji,
 * bukan ditelan diam-diam di dalam adapter.
 */

import type {
  CatalogVersion,
  CompatibleFitting,
  Product,
  ProductDocument,
} from '@snouty/shared-types';
import {
  CATALOG_ACTIVE_VERSION_KEY,
  catalogProductKey,
  type CatalogCache,
} from '../domain/catalog-cache.port.js';
import { CatalogUnavailableError, ProductNotFoundError } from '../domain/catalog.errors.js';
import type {
  CatalogRepository,
  ProductListPage,
  ProductListQuery,
} from '../domain/catalog.repository.js';

/** Filter dari klien — tanpa `catalogVersionId`, yang memang bukan urusan klien. */
export type PublicProductListQuery = Omit<ProductListQuery, 'catalogVersionId'>;

export class CatalogQueryService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly cache: CatalogCache,
  ) {}

  /** Dirender "KATALOG PRALON · v2.4" di bawah daftar produk. */
  async activeVersion(): Promise<CatalogVersion> {
    const cached = await this.readCache<CatalogVersion>(CATALOG_ACTIVE_VERSION_KEY);
    if (cached !== null) return cached;

    const version = await this.repository.findActiveVersion();
    if (version === null) throw new CatalogUnavailableError();

    await this.writeCache(CATALOG_ACTIVE_VERSION_KEY, version);
    return version;
  }

  /**
   * Daftar produk tidak di-cache per kombinasi filter.
   *
   * Kuncinya akan menjadi hasil kali setiap filter (`family` × `category` × ukuran
   * × kata pencarian × cursor), dan invalidasinya harus menebak kombinasi mana yang
   * pernah ada. Yang di-cache adalah produk per id — satu kunci, satu baris, dan
   * invalidasi yang bisa dibuktikan.
   */
  async listProducts(filter: PublicProductListQuery): Promise<ProductListPage> {
    const version = await this.activeVersion();
    return this.repository.listProducts({ ...filter, catalogVersionId: version.id });
  }

  async findProduct(productId: string): Promise<Product> {
    const key = catalogProductKey(productId);
    const cached = await this.readCache<Product>(key);
    if (cached !== null) return cached;

    const version = await this.activeVersion();
    const product = await this.repository.findProductById(version.id, productId);
    if (product === null) throw new ProductNotFoundError(productId);

    await this.writeCache(key, product);
    return product;
  }

  /**
   * Keberadaan produk diperiksa lebih dulu, sengaja.
   *
   * `product_compatibility` tidak punya kolom versi — ia terikat versi lewat
   * produknya. Tanpa pemeriksaan ini, id dari versi katalog lama akan tetap
   * mengembalikan daftar fittingnya, dan endpoint ini menjadi jalan membaca
   * katalog yang sudah diarsipkan.
   */
  async findCompatibleFittings(productId: string): Promise<readonly CompatibleFitting[]> {
    await this.findProduct(productId);
    return this.repository.findCompatibleFittings(productId);
  }

  /**
   * Keberadaan produk diperiksa lebih dulu, alasan yang sama dengan fitting sepadan:
   * `product_documents` terikat versi lewat produknya, bukan lewat kolom versi.
   */
  async findProductDocuments(productId: string): Promise<readonly ProductDocument[]> {
    await this.findProduct(productId);
    return this.repository.findProductDocuments(productId);
  }

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      return await this.cache.read<T>(key);
    } catch {
      // Cache yang tidak terjangkau diperlakukan sama dengan cache yang kosong:
      // MySQL tetap punya jawabannya.
      return null;
    }
  }

  private async writeCache(key: string, value: unknown): Promise<void> {
    try {
      await this.cache.write(key, value);
    } catch {
      // Gagal mengisi cache tidak boleh menggagalkan permintaan yang jawabannya
      // sudah ada di tangan. Permintaan berikutnya akan mencoba lagi.
      return;
    }
  }
}
