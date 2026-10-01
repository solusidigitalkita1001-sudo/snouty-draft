/**
 * Port sisi tulis katalog — dipisahkan dari `CatalogRepository` yang hanya membaca.
 *
 * Pemisahannya bukan upacara. Pembacaan katalog dipakai setiap permintaan oleh
 * matcher, laporan, dan drawer produk; penulisan hanya dipakai satu job dan satu
 * layar back-office berperan `catalog_admin`. Menyatukan keduanya berarti setiap
 * modul yang hanya perlu membaca ikut memegang kemampuan menulis katalog.
 */

import type { CatalogImportIssue, CatalogVersionStatus } from '@snouty/shared-types';
import type { AuditActor } from '../../../shared/audit/audit.types.js';
import type { ValidatedCatalogRow } from './catalog-import.contract.js';

export const CATALOG_WRITER = Symbol('CATALOG_WRITER');

export type CatalogImportRunStatus = 'pending' | 'rejected' | 'ingested' | 'failed';

export interface CatalogImportRun {
  readonly id: string;
  readonly label: string;
  readonly sourceDocument: string;
  readonly status: CatalogImportRunStatus;
  /** Terisi begitu versi draft dibuat, bukan setelah run selesai — lihat skema. */
  readonly catalogVersionId: string | null;
  readonly requestedBy: string;
  readonly rowsAccepted: number;
  readonly rowsRejected: number;
  readonly issues: readonly CatalogImportIssue[];
}

export interface FinishRunInput {
  readonly importRunId: string;
  readonly status: Exclude<CatalogImportRunStatus, 'pending'>;
  readonly rowsAccepted: number;
  readonly rowsRejected: number;
  readonly issues: readonly CatalogImportIssue[];
}

export interface PromotedVersion {
  readonly catalogVersionId: string;
  /** `null` bila ini versi aktif pertama — bukan berarti promosinya gagal. */
  readonly previousActiveId: string | null;
}

export interface CatalogWriter {
  findImportRun(importRunId: string): Promise<CatalogImportRun | null>;

  /**
   * Membuat versi `draft` dan menautkannya ke run **dalam satu transaksi**.
   *
   * Satu transaksi, bukan dua langkah, karena di antara keduanya terletak
   * satu-satunya cara job ini bisa menghasilkan dua versi katalog untuk satu impor.
   */
  createDraftVersion(run: CatalogImportRun): Promise<string>;

  /**
   * Idempoten: baris yang `rowHash`-nya sudah ada pada versi ini dilewati, dan
   * baris anaknya tidak ditulis ulang.
   */
  insertRows(catalogVersionId: string, rows: readonly ValidatedCatalogRow[]): Promise<void>;

  finishRun(input: FinishRunInput): Promise<void>;

  /**
   * Mengarsipkan versi aktif, mengaktifkan versi ini, dan menulis audit —
   * **seluruhnya dalam satu transaksi**.
   *
   * Satu transaksi bukan kehati-hatian berlebihan, melainkan syarat agar kodenya
   * bisa berjalan sama sekali: `uq_catalog_versions_single_active` akan menolak
   * versi aktif kedua, jadi pengarsipan harus sudah terjadi saat pengaktifan
   * dijalankan. Dan audit yang ditulis di luar transaksi adalah audit yang bisa
   * hilang justru pada kegagalan yang paling perlu ditelusuri.
   */
  promoteVersion(input: {
    readonly catalogVersionId: string;
    readonly actor: AuditActor;
  }): Promise<PromotedVersion>;
}

/** Versi yang diminta tidak ada. Berapa kali pun diulang, ia tetap tidak ada. */
export class CatalogVersionNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly retryable = false;

  constructor(readonly catalogVersionId: string) {
    super(`Versi katalog tidak ditemukan: ${catalogVersionId}`);
    this.name = 'CatalogVersionNotFoundError';
  }
}

/**
 * Hanya versi `draft` yang bisa dipromosikan.
 *
 * Versi `archived` sengaja tidak bisa dihidupkan kembali lewat jalur ini:
 * mengaktifkan kembali katalog lama adalah keputusan yang pantas terlihat sebagai
 * impor baru, bukan sebagai satu klik yang mengubah apa yang dilihat semua pengguna.
 */
export class CatalogVersionNotPromotableError extends Error {
  readonly code = 'VALIDATION_FAILED' as const;
  readonly retryable = false;

  constructor(
    readonly catalogVersionId: string,
    readonly status: CatalogVersionStatus,
  ) {
    super(`Versi katalog berstatus ${status} tidak bisa dipromosikan: ${catalogVersionId}`);
    this.name = 'CatalogVersionNotPromotableError';
  }
}

/**
 * Pesan menyebut run yang tidak ada di database.
 *
 * Ini bukan kegagalan yang pantas diulang: berapa kali pun dicoba, run-nya tetap
 * tidak ada. Karena itu ia harus berakhir di DLQ, bukan di queue retry.
 */
export class UnknownCatalogImportRunError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly retryable = false;

  constructor(readonly importRunId: string) {
    super(`Run impor katalog tidak ditemukan: ${importRunId}`);
    this.name = 'UnknownCatalogImportRunError';
  }
}
