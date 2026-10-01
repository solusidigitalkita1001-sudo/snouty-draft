/**
 * Implementasi MySQL dari `CatalogWriter`.
 *
 * Dua hal yang membentuk berkas ini:
 *
 * **Anak baris tidak boleh menjadi yatim.** Produk yang sudah ada dilewati, dan
 * karena itu ukuran serta spesifikasinya pun tidak ditulis ulang — menulisnya
 * dengan id produk baru akan meninggalkan baris anak yang tidak merujuk produk
 * mana pun. Karena itu `rowHash` yang sudah ada dibaca lebih dulu, bukan
 * diandalkan pada `INSERT IGNORE` saja.
 *
 * **Penyisipan berkelompok, bukan per baris.** Satu impor katalog bisa ratusan
 * baris; mengirim satu INSERT per baris berarti ratusan perjalanan bolak-balik ke
 * server yang dipakai bersama delapan aplikasi (docs/PERFORMANCE.md §3).
 */

import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { specHasValue } from '@snouty/shared-types';
import {
  catalogImportRuns,
  catalogVersions,
  productCompatibility,
  products,
  productSizes,
  productSpecs,
} from '../../../infrastructure/mysql/schema/catalog.js';
import { auditLogs } from '../../../infrastructure/mysql/schema/ops.js';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  type AuditActor,
} from '../../../shared/audit/audit.types.js';
import { DatabaseService, type QueryRunner } from '../../../shared/database/database.service.js';
import { ulid } from '../../../shared/ulid.js';
import type { ValidatedCatalogRow } from '../domain/catalog-import.contract.js';
import {
  CATALOG_WRITER,
  type CatalogImportRun,
  type CatalogImportRunStatus,
  type CatalogWriter,
  type FinishRunInput,
  type PromotedVersion,
} from '../domain/catalog-writer.repository.js';

/** Sekitar 200 baris per statement: cukup besar untuk hemat, cukup kecil untuk dibaca di log lambat. */
const INSERT_CHUNK = 200;

@Injectable()
export class MysqlCatalogWriter implements CatalogWriter {
  constructor(private readonly database: QueryRunner) {}

  async findImportRun(importRunId: string): Promise<CatalogImportRun | null> {
    const rows = await this.database.db
      .select({
        id: catalogImportRuns.id,
        label: catalogImportRuns.label,
        sourceDocument: catalogImportRuns.sourceDocument,
        status: catalogImportRuns.status,
        catalogVersionId: catalogImportRuns.catalogVersionId,
        requestedBy: catalogImportRuns.requestedBy,
        rowsAccepted: catalogImportRuns.rowsAccepted,
        rowsRejected: catalogImportRuns.rowsRejected,
        issues: catalogImportRuns.issues,
      })
      .from(catalogImportRuns)
      .where(eq(catalogImportRuns.id, importRunId))
      .limit(1);

    const row = rows[0];
    if (row === undefined) return null;

    return {
      id: row.id,
      label: row.label,
      sourceDocument: row.sourceDocument,
      status: toRunStatus(row.status),
      catalogVersionId: row.catalogVersionId,
      requestedBy: row.requestedBy,
      rowsAccepted: row.rowsAccepted,
      rowsRejected: row.rowsRejected,
      issues: Array.isArray(row.issues) ? row.issues : [],
    };
  }

  /**
   * Versi dibuat dan ditautkan dalam satu transaksi. Celah di antara kedua
   * statement itu adalah satu-satunya tempat impor ini bisa melahirkan dua versi.
   */
  async createDraftVersion(run: CatalogImportRun): Promise<string> {
    const catalogVersionId = ulid();

    await this.database.db.transaction(async (tx) => {
      await tx.insert(catalogVersions).values({
        id: catalogVersionId,
        label: run.label,
        sourceDocument: run.sourceDocument,
        status: 'draft',
        effectiveFrom: new Date(),
        importedBy: run.requestedBy,
      });
      await tx
        .update(catalogImportRuns)
        .set({ catalogVersionId })
        .where(eq(catalogImportRuns.id, run.id));
    });

    return catalogVersionId;
  }

  async insertRows(catalogVersionId: string, rows: readonly ValidatedCatalogRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: products.id, rowHash: products.rowHash, sku: products.sku })
        .from(products)
        .where(eq(products.catalogVersionId, catalogVersionId));

      const idByRowHash = new Map(existing.map((row) => [row.rowHash, row.id]));
      const idBySku = new Map(existing.map((row) => [row.sku.toLowerCase(), row.id]));

      const fresh = rows.filter((row) => !idByRowHash.has(row.rowHash));
      const idByRow = new Map<string, string>();
      for (const row of fresh) {
        const productId = ulid();
        idByRow.set(row.rowHash, productId);
        idBySku.set(row.sku.toLowerCase(), productId);
      }

      for (const batch of chunk(fresh)) {
        await tx.insert(products).values(
          batch.map((row) => ({
            id: idByRow.get(row.rowHash)!,
            catalogVersionId,
            sku: row.sku,
            name: row.name,
            family: row.family,
            category: row.category,
            description: row.description,
            status: row.status,
            sourceDocument: row.sourceDocument,
            sourcePage: row.sourcePage,
            imageUrl: row.imageUrl,
            rowHash: row.rowHash,
          })),
        );
      }

      const sizeValues = fresh.flatMap((row) =>
        row.sizes.map((size) => ({
          productId: idByRow.get(row.rowHash)!,
          // Inci × 1000, supaya perbandingan dan pengurutan tetap bilangan bulat.
          sizeInches: Math.round(size.inches * 1000),
          sizeLabel: size.label,
        })),
      );
      for (const batch of chunk(sizeValues)) await tx.insert(productSizes).values(batch);

      // Spesifikasi kosong TETAP menjadi baris, bertanda UNAVAILABLE. Baris yang
      // hilang dan baris bernilai kosong adalah dua hal berbeda bagi UI: yang satu
      // dirender "Lihat dokumen teknis", yang lain tidak dirender sama sekali.
      const specValues = fresh.flatMap((row) =>
        Object.entries(row.specs).map(([specKey, spec]) => ({
          productId: idByRow.get(row.rowHash)!,
          specKey,
          specValue: spec.value,
          provenance: spec.provenance,
          // Sitasi hanya ada pada nilai yang terverifikasi; penjaga ini yang
          // membuat tipenya cukup sempit untuk membaca kedua kolom itu.
          sourceDocument: specHasValue(spec) ? (spec.sourceDocument ?? null) : null,
          sourcePage: specHasValue(spec) ? (spec.sourcePage ?? null) : null,
        })),
      );
      for (const batch of chunk(specValues)) await tx.insert(productSpecs).values(batch);

      // Kompatibilitas ditulis setelah SELURUH produk ada — termasuk produk dari
      // percobaan sebelumnya — karena rujukannya bisa menunjuk baris mana pun.
      const compatibilityValues = rows.flatMap((row) => {
        const productId = idByRow.get(row.rowHash) ?? idByRowHash.get(row.rowHash);
        if (productId === undefined) return [];
        return row.compatibleSkus.flatMap((ref) => {
          const compatibleProductId = idBySku.get(ref.sku.toLowerCase());
          // Validator sudah membuktikan rujukannya ada di impor ini; kalau sampai
          // hilang di sini, melewatkannya lebih baik daripada menulis id palsu.
          if (compatibleProductId === undefined) return [];
          return [{ productId, compatibleProductId, kind: ref.kind }];
        });
      });
      for (const batch of chunk(compatibilityValues)) {
        // `INSERT IGNORE`: kunci primernya (produk + produk sepadan) sudah membuat
        // penulisan ulang pasangan yang sama tidak berbahaya, jadi percobaan kedua
        // tidak perlu membaca dulu apa yang sudah ada.
        await tx.insert(productCompatibility).ignore().values(batch);
      }
    });
  }

  async promoteVersion(input: {
    readonly catalogVersionId: string;
    readonly actor: AuditActor;
  }): Promise<PromotedVersion> {
    return this.database.db.transaction(async (tx) => {
      const current = await tx
        .select({ id: catalogVersions.id })
        .from(catalogVersions)
        .where(eq(catalogVersions.status, 'active'))
        .limit(1);
      const previousActiveId = current[0]?.id ?? null;

      // Mengarsipkan LEBIH DULU. Bukan pilihan gaya: unique index
      // `uq_catalog_versions_single_active` akan menolak versi aktif kedua, jadi
      // urutan sebaliknya membuat promosi gagal setiap kali sudah ada versi aktif.
      if (previousActiveId !== null) {
        await tx
          .update(catalogVersions)
          .set({ status: 'archived' })
          .where(eq(catalogVersions.id, previousActiveId));
        await tx.insert(auditLogs).values(
          auditRow(input.actor, {
            action: AUDIT_ACTIONS.catalogVersionArchive,
            entityId: previousActiveId,
            before: { status: 'active' },
            after: { status: 'archived' },
          }),
        );
      }

      await tx
        .update(catalogVersions)
        .set({ status: 'active' })
        .where(eq(catalogVersions.id, input.catalogVersionId));
      await tx.insert(auditLogs).values(
        auditRow(input.actor, {
          action: AUDIT_ACTIONS.catalogVersionPromote,
          entityId: input.catalogVersionId,
          before: { status: 'draft' },
          after: { status: 'active' },
        }),
      );

      return { catalogVersionId: input.catalogVersionId, previousActiveId };
    });
  }

  async finishRun(input: FinishRunInput): Promise<void> {
    await this.database.db
      .update(catalogImportRuns)
      .set({
        status: input.status,
        rowsAccepted: input.rowsAccepted,
        rowsRejected: input.rowsRejected,
        issues: input.issues,
        finishedAt: new Date(),
      })
      .where(eq(catalogImportRuns.id, input.importRunId));
  }
}

/**
 * `before_json` dan `after_json` memuat **hanya field yang berubah**
 * (docs/BACKOFFICE.md §6).
 *
 * Versi mana yang digantikan tidak ikut di sini: ia tercatat sebagai baris audit
 * `catalog.version.archive` tersendiri, ditulis dalam transaksi yang sama.
 * Menempelkannya ke `after_json` akan mengubah "field yang berubah" menjadi
 * "apa pun yang terasa berguna saat itu", dan aturan seperti itu selalu melebar.
 */
function auditRow(
  actor: AuditActor,
  change: {
    action: string;
    entityId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
) {
  return {
    id: ulid(),
    actorId: actor.id,
    actorRole: actor.role,
    action: change.action,
    entityType: AUDIT_ENTITIES.catalogVersion,
    entityId: change.entityId,
    beforeJson: change.before,
    afterJson: change.after,
    correlationId: actor.correlationId ?? null,
    ip: actor.ip ?? null,
  };
}

function toRunStatus(raw: string): CatalogImportRunStatus {
  if (raw === 'pending' || raw === 'rejected' || raw === 'ingested' || raw === 'failed') return raw;
  // CHECK di database sudah membatasi nilainya; kalau lolos sampai sini,
  // constraint-nya hilang — itu kabar yang harus terdengar.
  throw new Error(`status run impor katalog tidak dikenal di database: ${raw}`);
}

function chunk<T>(items: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += INSERT_CHUNK) {
    batches.push(items.slice(start, start + INSERT_CHUNK));
  }
  return batches;
}

/** Factory untuk DI Nest — writer-nya sendiri hanya bergantung pada `QueryRunner`. */
export const catalogWriterProvider = {
  provide: CATALOG_WRITER,
  inject: [DatabaseService],
  useFactory: (database: DatabaseService): CatalogWriter => new MysqlCatalogWriter(database),
};
