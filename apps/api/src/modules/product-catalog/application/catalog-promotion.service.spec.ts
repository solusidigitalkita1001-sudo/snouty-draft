/**
 * P1-07 — keputusan promosi versi katalog, tanpa database dan tanpa Redis.
 *
 * Yang paling penting di berkas ini adalah tes urutan: cache dibuang **setelah**
 * promosi di-commit. Urutan sebaliknya membuka jendela di mana pembaca lain
 * mengisi ulang cache dari versi lama, dan isian itu bertahan satu jam penuh.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogVersion, CatalogVersionStatus } from '@snouty/shared-types';
import type { AuditActor } from '../../../shared/audit/audit.types.js';
import type { CatalogCache } from '../domain/catalog-cache.port.js';
import type { CatalogRepository } from '../domain/catalog.repository.js';
import {
  CatalogVersionNotFoundError,
  CatalogVersionNotPromotableError,
  type CatalogWriter,
  type PromotedVersion,
} from '../domain/catalog-writer.repository.js';
import { CatalogPromotionService } from './catalog-promotion.service.js';

const VERSION_ID = 'VERSION';
const PREVIOUS_ID = 'PREVIOUS';
const ACTOR: AuditActor = { id: 'ADMIN', role: 'catalog_admin' };

function version(status: CatalogVersionStatus): CatalogVersion {
  return {
    id: VERSION_ID,
    label: 'v2.4',
    sourceDocument: 'Katalog produk Pralon 2026',
    status,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    importedBy: 'ADMIN',
  };
}

/** Satu pencatat untuk ketiga kolaborator, supaya urutan antar-objek ikut teruji. */
class Recorder {
  readonly calls: string[] = [];

  constructor(private readonly stored: CatalogVersion | null) {}

  readonly versions: Pick<CatalogRepository, 'findVersionById'> = {
    findVersionById: async () => {
      this.calls.push('findVersionById');
      return this.stored;
    },
  };

  readonly writer: Pick<CatalogWriter, 'promoteVersion'> = {
    promoteVersion: async (): Promise<PromotedVersion> => {
      this.calls.push('promoteVersion');
      return { catalogVersionId: VERSION_ID, previousActiveId: PREVIOUS_ID };
    },
  };

  readonly cache: CatalogCache = {
    invalidateAll: async () => {
      this.calls.push('invalidateAll');
      return 7;
    },
  };

  service(): CatalogPromotionService {
    return new CatalogPromotionService(
      this.versions as CatalogRepository,
      this.writer as CatalogWriter,
      this.cache,
    );
  }
}

describe('CatalogPromotionService — apa yang boleh dipromosikan', () => {
  it('menolak versi yang tidak ada', async () => {
    const recorder = new Recorder(null);

    await expect(
      recorder.service().promote({ catalogVersionId: VERSION_ID, actor: ACTOR }),
    ).rejects.toThrow(CatalogVersionNotFoundError);
  });

  it('menolak menghidupkan kembali versi yang sudah diarsipkan', async () => {
    // Mengaktifkan kembali katalog lama pantas terlihat sebagai impor baru, bukan
    // sebagai satu klik yang mengubah apa yang dilihat semua pengguna.
    const recorder = new Recorder(version('archived'));

    await expect(
      recorder.service().promote({ catalogVersionId: VERSION_ID, actor: ACTOR }),
    ).rejects.toThrow(CatalogVersionNotPromotableError);
  });

  it('tidak menyentuh apa pun saat versinya memang sudah aktif', async () => {
    const recorder = new Recorder(version('active'));

    const outcome = await recorder.service().promote({
      catalogVersionId: VERSION_ID,
      actor: ACTOR,
    });

    expect(recorder.calls).toEqual(['findVersionById']);
    expect(outcome.changed).toBe(false);
  });
});

describe('CatalogPromotionService — urutan yang mengikat', () => {
  it('membuang cache SETELAH promosi, bukan sebelumnya', async () => {
    const recorder = new Recorder(version('draft'));

    await recorder.service().promote({ catalogVersionId: VERSION_ID, actor: ACTOR });

    expect(recorder.calls).toEqual(['findVersionById', 'promoteVersion', 'invalidateAll']);
  });

  it('melaporkan versi yang digantikan dan jumlah kunci cache yang terbuang', async () => {
    const recorder = new Recorder(version('draft'));

    const outcome = await recorder.service().promote({
      catalogVersionId: VERSION_ID,
      actor: ACTOR,
    });

    expect(outcome).toEqual({
      catalogVersionId: VERSION_ID,
      previousActiveId: PREVIOUS_ID,
      cacheKeysInvalidated: 7,
      changed: true,
    });
  });
});
