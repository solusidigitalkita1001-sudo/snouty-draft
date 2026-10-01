/**
 * P1-10a — sisi controller: setiap tulis membawa aktor audit, dan parameter yang
 * tidak masuk akal ditolak sebelum menyentuh database.
 *
 * Penjagaan perannya diuji terpisah di `shared/http/internal-role.guard.spec.ts`;
 * di sini yang diuji adalah apa yang diteruskan controller setelah guard lolos.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogVersion } from '@snouty/shared-types';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import type { AuditActor } from '../../../shared/audit/audit.types.js';
import { UnauthenticatedError } from '../../../shared/http/api-errors.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import {
  CatalogPromotionService,
  type CatalogPromotionOutcome,
  type PromoteCatalogVersionCommand,
} from '../application/catalog-promotion.service.js';
import { InvalidCatalogQueryError } from '../domain/catalog.errors.js';
import type { CatalogImportRun } from '../domain/catalog-writer.repository.js';
import { InternalCatalogController } from './internal-catalog.controller.js';

const VERSION_ID = 'V'.padEnd(26, '0');
const RUN_ID = 'R'.padEnd(26, '0');

const DRAFT: CatalogVersion = {
  id: VERSION_ID,
  label: 'v2.5',
  sourceDocument: 'Katalog produk Pralon 2026',
  status: 'draft',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  importedBy: 'ADMIN',
};

const RUN: CatalogImportRun = {
  id: RUN_ID,
  label: 'v2.5',
  sourceDocument: 'Katalog produk Pralon 2026',
  status: 'rejected',
  catalogVersionId: null,
  requestedBy: 'ADMIN',
  rowsAccepted: 0,
  rowsRejected: 1,
  issues: [{ rowNumber: 2, column: 'sku', message: 'Kolom `sku` wajib diisi.' }],
};

class FakeAdmin {
  async listVersions(): Promise<readonly CatalogVersion[]> {
    return [DRAFT];
  }
  async findImportRun(): Promise<CatalogImportRun> {
    return RUN;
  }
}

class FakePromotion {
  lastCommand: PromoteCatalogVersionCommand | null = null;

  async promote(command: PromoteCatalogVersionCommand): Promise<CatalogPromotionOutcome> {
    this.lastCommand = command;
    return {
      catalogVersionId: command.catalogVersionId,
      previousActiveId: null,
      cacheKeysInvalidated: 3,
      changed: true,
    };
  }
}

function controllerWith(promotion: FakePromotion = new FakePromotion()): {
  controller: InternalCatalogController;
  promotion: FakePromotion;
} {
  const controller = new InternalCatalogController(
    new FakeAdmin() as unknown as CatalogAdminService,
    promotion as unknown as CatalogPromotionService,
  );
  return { controller, promotion };
}

function requestFrom(actor: { id: string; roles: readonly string[] } | undefined) {
  return {
    ...(actor !== undefined ? { internalActor: actor } : {}),
    correlationId: 'corr-1',
    ip: '10.0.0.7',
    headers: {},
  } as never;
}

describe('GET /internal/catalog/versions', () => {
  it('mengembalikan versi draft juga — justru itu gunanya layar ini', async () => {
    const { controller } = controllerWith();

    const response = await controller.listVersions();

    expect(response).toEqual({ items: [DRAFT] });
  });
});

describe('GET /internal/catalog/imports/:id', () => {
  it('mengembalikan laporan galat per baris apa adanya, tanpa diringkas', async () => {
    // Ringkasan galat berarti admin harus mengunggah ulang untuk melihat sisanya.
    const { controller } = controllerWith();

    const response = await controller.findImportRun({ id: RUN_ID });

    expect(response.issues).toEqual([
      { rowNumber: 2, column: 'sku', message: 'Kolom `sku` wajib diisi.' },
    ]);
  });

  it('menolak id yang bukan ULID 26 karakter', async () => {
    const { controller } = controllerWith();

    await expect(controller.findImportRun({ id: 'pendek' })).rejects.toThrow(
      InvalidCatalogQueryError,
    );
  });
});

describe('POST /internal/catalog/versions/:id/promote', () => {
  it('meneruskan aktor audit dengan peran rutenya dan correlation id permintaannya', async () => {
    const { controller, promotion } = controllerWith();

    await controller.promote(
      { id: VERSION_ID },
      requestFrom({ id: 'ADMIN', roles: [INTERNAL_ROLES.catalogAdmin] }),
    );

    const actor: AuditActor | undefined = promotion.lastCommand?.actor;
    expect(actor).toEqual({
      id: 'ADMIN',
      role: 'catalog_admin',
      correlationId: 'corr-1',
      ip: '10.0.0.7',
    });
  });

  it('melaporkan versi yang digantikan dan jumlah kunci cache yang terbuang', async () => {
    const { controller } = controllerWith();

    const outcome = await controller.promote(
      { id: VERSION_ID },
      requestFrom({ id: 'ADMIN', roles: [INTERNAL_ROLES.catalogAdmin] }),
    );

    expect(outcome).toEqual({
      catalogVersionId: VERSION_ID,
      previousActiveId: null,
      cacheKeysInvalidated: 3,
      changed: true,
    });
  });

  it('tidak pernah mempromosikan tanpa aktor, bahkan bila guard dilewati', async () => {
    // Lapis kedua di controller: kalau suatu hari ada yang melepas guard-nya,
    // promosi tanpa jejak audit tetap tidak mungkin terjadi.
    const { controller, promotion } = controllerWith();

    await expect(controller.promote({ id: VERSION_ID }, requestFrom(undefined))).rejects.toThrow(
      UnauthenticatedError,
    );
    expect(promotion.lastCommand).toBeNull();
  });

  it('menolak id yang tidak masuk akal sebelum menyentuh database', async () => {
    const { controller, promotion } = controllerWith();

    await expect(
      controller.promote(
        { id: 'bukan-ulid' },
        requestFrom({ id: 'ADMIN', roles: [INTERNAL_ROLES.catalogAdmin] }),
      ),
    ).rejects.toThrow(InvalidCatalogQueryError);
    expect(promotion.lastCommand).toBeNull();
  });
});
