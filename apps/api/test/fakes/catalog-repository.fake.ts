/**
 * Basis fake untuk `CatalogRepository`.
 *
 * Ada karena penambahan method ke port sudah tiga kali memecahkan fake yang sama di
 * spec yang berbeda — dan setiap kali perbaikannya identik. Basis ini memusatkannya:
 * method baru pada port cukup ditambahkan **sekali** di sini.
 *
 * Setiap method **melempar** secara baku, bukan mengembalikan nilai kosong. Itu
 * disengaja: fake yang mengembalikan `[]` untuk method yang tidak diniatkan membuat
 * tes lulus karena alasan yang salah, dan kegagalannya muncul jauh dari penyebabnya.
 * Melempar memaksa setiap spec menyatakan apa yang memang dipakainya.
 */
import type {
  CatalogVersion,
  CompatibleFitting,
  Product,
  ProductDocument,
} from '@snouty/shared-types';
import type {
  CatalogRepository,
  FamilyCount,
  ProductListPage,
  ProductListQuery,
} from '../../src/modules/product-catalog/domain/catalog.repository.js';

function unused(method: string): never {
  throw new Error(`CatalogRepository.${method} tidak diniatkan dipakai di tes ini`);
}

export class FakeCatalogRepository implements CatalogRepository {
  async findActiveVersion(): Promise<CatalogVersion | null> {
    return unused('findActiveVersion');
  }

  async findVersionById(): Promise<CatalogVersion | null> {
    return unused('findVersionById');
  }

  async listVersions(): Promise<readonly CatalogVersion[]> {
    return unused('listVersions');
  }

  async listProducts(_query: ProductListQuery): Promise<ProductListPage> {
    return unused('listProducts');
  }

  async findProductById(): Promise<Product | null> {
    return unused('findProductById');
  }

  async findCompatibleFittings(): Promise<readonly CompatibleFitting[]> {
    return unused('findCompatibleFittings');
  }

  async findProductDocuments(): Promise<readonly ProductDocument[]> {
    return unused('findProductDocuments');
  }

  async familyCounts(): Promise<readonly FamilyCount[]> {
    return unused('familyCounts');
  }

  async productNamesInFamily(): Promise<readonly string[]> {
    return unused('productNamesInFamily');
  }
}
