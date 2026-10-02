/**
 * Kontrak job antara `apps/api` (publisher) dan `apps/worker` (konsumer).
 *
 * Menjawab **OQ-40** dengan usulan default yang tercatat di sana: kontrak dan tipe bersama
 * hidup di paket ini, dan **`apps/worker` tidak pernah mengimpor `apps/api`**. Dua alasan
 * yang membuat arah itu penting:
 *
 * 1. Mengimpor API dari worker akan menarik seluruh Nest, Drizzle, dan koneksi database ke
 *    dalam image yang sebenarnya hanya perlu Chromium — dan membalik arah dependensi yang
 *    dijaga `docs/ARCHITECTURE.md` §7.
 * 2. Kontrak yang dibagi lewat paket bisa **diversi**. Payload yang berubah bentuk tanpa
 *    sepengetahuan konsumer adalah cara job gagal diam-diam di produksi.
 *
 * Setiap payload punya skema zod: pesan datang dari antrean, dan antrean bisa memuat pesan
 * dari versi kode yang lebih lama. Validasi di tepi, bukan kepercayaan.
 */

import { z } from 'zod';

/** Nama antrean. Satu tempat, supaya publisher dan konsumer tidak pernah salah ketik. */
export const QUEUES = {
  reportGenerate: 'snouty.report.generate',
  catalogIngest: 'snouty.catalog.ingest',
  emailAnalyze: 'snouty.email.analyze',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Versi kontrak. Dinaikkan saat bentuk payload berubah; konsumer menolak versi yang tidak
 * dikenalnya alih-alih menebak-nebak field yang hilang.
 */
export const CONTRACT_VERSION = 1;

const envelope = {
  contractVersion: z.literal(CONTRACT_VERSION),
  /** Mengalir ke log worker supaya satu permintaan bisa dilacak lintas proses. */
  correlationId: z.string().min(1).max(64),
};

/**
 * `report.generate` — worker membuka halaman cetak internal dan mencetaknya ke PDF.
 *
 * Payload sengaja **hanya membawa id**, bukan isi laporan: isinya sudah dibekukan di baris
 * `reports`, dan menyalinnya ke dalam pesan antrean berarti dua sumber kebenaran yang bisa
 * berbeda. Juga berarti data pribadi (nama pelanggan, lokasi) tidak pernah berada di dalam
 * antrean.
 */
export const ReportGenerateJob = z
  .object({
    ...envelope,
    reportId: z.string().length(26),
  })
  .strict();

export type ReportGenerateJob = z.infer<typeof ReportGenerateJob>;

/** `catalog.ingest` — idempoten per `catalogVersionId + rowHash` (SPEC §10). */
export const CatalogIngestJob = z
  .object({
    ...envelope,
    importRunId: z.string().length(26),
    catalogVersionId: z.string().length(26),
  })
  .strict();

export type CatalogIngestJob = z.infer<typeof CatalogIngestJob>;

/** `email.analyze` — hanya id; isi email tidak pernah masuk antrean (docs/PRIVACY.md). */
export const EmailAnalyzeJob = z
  .object({
    ...envelope,
    emailId: z.string().length(26),
  })
  .strict();

export type EmailAnalyzeJob = z.infer<typeof EmailAnalyzeJob>;

/** Peta antrean → skema, supaya konsumer tidak memilih validator secara manual. */
export const JOB_SCHEMA = {
  [QUEUES.reportGenerate]: ReportGenerateJob,
  [QUEUES.catalogIngest]: CatalogIngestJob,
  [QUEUES.emailAnalyze]: EmailAnalyzeJob,
} as const;

/**
 * Kebijakan percobaan ulang. Backoff eksponensial, lalu DLQ — job yang gagal selamanya
 * tidak boleh memblokir antrean, dan job yang hilang tanpa jejak tidak bisa diperbaiki.
 */
export const RETRY_POLICY = {
  maxAttempts: 3,
  /** Jeda per percobaan, dalam milidetik. */
  backoffMs: [1_000, 5_000, 30_000],
  deadLetterSuffix: '.dlq',
} as const;

export function deadLetterQueueOf(queue: QueueName): string {
  return `${queue}${RETRY_POLICY.deadLetterSuffix}`;
}

export function backoffFor(attempt: number): number {
  const index = Math.min(attempt - 1, RETRY_POLICY.backoffMs.length - 1);
  return RETRY_POLICY.backoffMs[Math.max(0, index)]!;
}
