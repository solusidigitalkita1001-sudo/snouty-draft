/**
 * Use case `catalog.ingest` — orkestrasi, bukan SQL dan bukan transport.
 *
 * Service ini tidak tahu RabbitMQ ada. Ia menerima satu perintah dan bisa
 * dipanggil konsumer antrean, skrip, atau tes; itu yang membuat invarian
 * "impor yang sama dua kali menghasilkan satu versi" bisa dibuktikan tanpa broker
 * (docs/ARCHITECTURE.md §5 — transaksi dimulai di lapisan application).
 *
 * Tiga hal yang membuatnya idempoten, dari yang paling luar ke paling dalam:
 *
 *   1. Run yang sudah `ingested` langsung mengembalikan hasil tersimpannya.
 *      Pengiriman ulang pesan setelah sukses tidak menyentuh database.
 *   2. Versi draft yang sudah tertaut pada run dipakai ulang, tidak dibuat lagi.
 *      Ini yang menyelamatkan proses yang mati di tengah jalan.
 *   3. Penyisipan baris dikunci `uq_products_version_row_hash` di database.
 *
 * Lapisan ketiga yang menentukan: dua lapisan pertama adalah kode yang bisa
 * dilewati, yang ketiga tidak bisa.
 */

import type { CatalogImportResult } from '@snouty/shared-types';
import type { CatalogImportSource } from '../domain/catalog-import.contract.js';
import { validateCatalogImport } from '../domain/catalog-import.validator.js';
import {
  UnknownCatalogImportRunError,
  type CatalogWriter,
} from '../domain/catalog-writer.repository.js';

export interface CatalogIngestCommand {
  readonly importRunId: string;
  readonly source: CatalogImportSource;
}

export class CatalogIngestService {
  constructor(private readonly writer: CatalogWriter) {}

  async ingest(command: CatalogIngestCommand): Promise<CatalogImportResult> {
    const run = await this.writer.findImportRun(command.importRunId);
    if (run === null) throw new UnknownCatalogImportRunError(command.importRunId);

    if (run.status === 'ingested') {
      return {
        catalogVersionId: run.catalogVersionId,
        rowsAccepted: run.rowsAccepted,
        rowsRejected: run.rowsRejected,
        issues: run.issues,
      };
    }

    const validation = validateCatalogImport(command.source);
    const rowsAccepted = validation.rows.length;
    // Setiap baris yang tidak lolos adalah baris yang ditolak — termasuk saat yang
    // gagal adalah headernya, karena baris mana pun jadi tidak bisa dibaca.
    const rowsRejected = command.source.rows.length - rowsAccepted;

    if (validation.issues.length > 0) {
      // Seluruhnya atau tidak sama sekali (usulan default OQ-38): versi draft yang
      // setengah terisi tetap terlihat lengkap di layar promosi, dan admin yang
      // mempromosikannya akan mengirim katalog berlubang ke pengguna.
      await this.writer.finishRun({
        importRunId: run.id,
        status: 'rejected',
        rowsAccepted,
        rowsRejected,
        issues: validation.issues,
      });
      return { catalogVersionId: null, rowsAccepted, rowsRejected, issues: validation.issues };
    }

    const catalogVersionId = run.catalogVersionId ?? (await this.writer.createDraftVersion(run));
    await this.writer.insertRows(catalogVersionId, validation.rows);
    await this.writer.finishRun({
      importRunId: run.id,
      status: 'ingested',
      rowsAccepted,
      rowsRejected,
      issues: [],
    });

    return { catalogVersionId, rowsAccepted, rowsRejected, issues: [] };
  }
}
