/**
 * Pembacaan untuk back-office katalog — dipisahkan dari `CatalogQueryService`
 * karena yang dilihat `catalog_admin` memang berbeda dari yang dilihat pengguna.
 *
 * Pengguna hanya pernah melihat versi aktif. Admin katalog justru harus melihat
 * yang **belum** aktif: draft yang menunggu ditinjau, dan run impor yang ditolak
 * beserta laporan galatnya. Menyatukan keduanya dalam satu service berarti satu
 * kelalaian kecil bisa membocorkan katalog draft ke jalur publik.
 */

import type { CatalogVersion } from '@snouty/shared-types';
import type { CatalogRepository } from '../domain/catalog.repository.js';
import {
  UnknownCatalogImportRunError,
  type CatalogImportRun,
  type CatalogWriter,
} from '../domain/catalog-writer.repository.js';

export class CatalogAdminService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly writer: CatalogWriter,
  ) {}

  /** Terbaru lebih dulu — termasuk draft dan yang sudah diarsipkan. */
  async listVersions(): Promise<readonly CatalogVersion[]> {
    return this.repository.listVersions();
  }

  /**
   * Laporan satu run impor, termasuk seluruh galat per barisnya.
   *
   * Inilah yang membuat "semua galat dilaporkan sekaligus" sampai ke admin:
   * validator mengumpulkannya, job menyimpannya, dan endpoint ini mengembalikannya
   * apa adanya — tanpa diringkas, karena ringkasan galat berarti admin harus
   * mengunggah ulang untuk melihat sisanya.
   */
  async findImportRun(importRunId: string): Promise<CatalogImportRun> {
    const run = await this.writer.findImportRun(importRunId);
    if (run === null) throw new UnknownCatalogImportRunError(importRunId);
    return run;
  }
}
