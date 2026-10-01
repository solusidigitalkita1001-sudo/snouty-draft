/**
 * Promosi versi katalog `draft` → `active`.
 *
 * Ini aksi paling berdampak di seluruh back-office: ia mengubah apa yang dilihat
 * **semua** pengguna sekaligus (docs/BACKOFFICE.md §4.1). Tiga hal karena itu
 * mengikat, bukan opsional — satu versi aktif, audit, dan invalidasi cache.
 */

import type { CatalogRepository } from '../domain/catalog.repository.js';
import type { CatalogCache } from '../domain/catalog-cache.port.js';
import {
  CatalogVersionNotFoundError,
  CatalogVersionNotPromotableError,
  type CatalogWriter,
  type PromotedVersion,
} from '../domain/catalog-writer.repository.js';
import type { AuditActor } from '../../../shared/audit/audit.types.js';

export interface PromoteCatalogVersionCommand {
  readonly catalogVersionId: string;
  readonly actor: AuditActor;
}

export interface CatalogPromotionOutcome extends PromotedVersion {
  /** Jumlah kunci cache yang terbuang. 0 bukan kegagalan — cache memang bisa kosong. */
  readonly cacheKeysInvalidated: number;
  /** `false` bila versinya memang sudah aktif, sehingga tidak ada yang berubah. */
  readonly changed: boolean;
}

export class CatalogPromotionService {
  constructor(
    private readonly versions: CatalogRepository,
    private readonly writer: CatalogWriter,
    private readonly cache: CatalogCache,
  ) {}

  async promote(command: PromoteCatalogVersionCommand): Promise<CatalogPromotionOutcome> {
    const version = await this.versions.findVersionById(command.catalogVersionId);
    if (version === null) throw new CatalogVersionNotFoundError(command.catalogVersionId);

    // Versi yang sudah aktif: keadaan akhir yang diminta sudah berlaku, jadi ini
    // keberhasilan tanpa pekerjaan — bukan galat. Tidak ada audit, karena tidak ada
    // yang berubah, dan audit yang mencatat perubahan kosong hanya mengaburkan
    // audit yang benar-benar berarti.
    if (version.status === 'active') {
      return {
        catalogVersionId: version.id,
        previousActiveId: null,
        cacheKeysInvalidated: 0,
        changed: false,
      };
    }

    if (version.status !== 'draft') {
      throw new CatalogVersionNotPromotableError(version.id, version.status);
    }

    const promoted = await this.writer.promoteVersion({
      catalogVersionId: version.id,
      actor: command.actor,
    });

    // Cache dibuang SETELAH transaksi commit, bukan sebelumnya. Membuangnya lebih
    // dulu membuka jendela di mana pembaca lain mengisi ulang cache dari versi lama
    // yang masih aktif — dan isian itu akan bertahan satu jam penuh.
    //
    // Urutan ini tidak menutup jendela sepenuhnya: pembaca yang sudah mengambil data
    // lama tepat sebelum commit masih bisa menulisnya setelah invalidasi. Yang
    // membatasi dampaknya adalah TTL, dan katalog berubah beberapa kali setahun —
    // menukar kebenaran mutlak di sini dengan kerumitan dua fase bukan pertukaran
    // yang masuk akal.
    const cacheKeysInvalidated = await this.cache.invalidateAll();

    return { ...promoted, cacheKeysInvalidated, changed: true };
  }
}
