/**
 * Konsumer `report.generate` — mencetak halaman laporan ke PDF. P8-08/P10-05.
 * docs/REPORT.md §5.
 *
 * **Mengapa Chromium, bukan pustaka PDF.** Laporannya sudah ada sebagai dokumen HTML/CSS
 * yang presisi, dirender `apps/api` di `/internal/reports/:id/print`. Membangunnya ulang
 * dengan pdfkit berarti memelihara dua model tata letak yang akan saling menyimpang dalam
 * hitungan bulan. Chromium mencetak CSS yang sudah ditulis.
 *
 * Konsumer ini **tidak pernah menyentuh database**. Ia meminta HTML dari API, mencetak, lalu
 * melaporkan hasilnya kembali lewat API. Itu yang menjaga arah dependensi OQ-40: worker
 * tidak mengimpor kode domain API, dan tidak memegang kredensial database.
 *
 * Idempoten per `reportId`: job yang diulang menulis berkas dengan nama yang sama, jadi dua
 * percobaan tidak menghasilkan dua berkas (docs/REPORT.md §5).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import type { ReportGenerateJob } from '@snouty/jobs';
import type { Logger } from 'pino';
import type { ConsumerContext } from '../transport/rabbitmq.js';

/** Timeout cetak. Di luar ini laporan ditandai FAILED (docs/REPORT.md §5). */
const PRINT_TIMEOUT_MS = 60_000;

export interface ReportPdfDeps {
  readonly apiBaseUrl: string;
  /** Token peran internal untuk rute cetak. Token bertanda tangan menyusul (§5). */
  readonly internalToken: string;
  readonly storagePath: string;
  readonly log: Logger;
  /** Disuntikkan supaya konsumer bisa diuji tanpa Chromium sungguhan. */
  readonly launchBrowser: () => Promise<PrintableBrowser>;
}

/** Permukaan Playwright sekecil yang benar-benar dipakai — itu yang membuatnya bisa dipalsukan. */
export interface PrintableBrowser {
  newPage(): Promise<PrintablePage>;
  close(): Promise<void>;
}

export interface PrintablePage {
  setContent(html: string, options?: { waitUntil?: 'load' }): Promise<void>;
  pdf(options: { format: string; printBackground: boolean }): Promise<Buffer>;
  close(): Promise<void>;
}

export function reportPdfConsumer(deps: ReportPdfDeps) {
  return async function handle(job: ReportGenerateJob, context: ConsumerContext): Promise<void> {
    const log = deps.log.child({ reportId: job.reportId, correlationId: context.correlationId });

    const html = await fetchPrintPage(deps, job.reportId);
    const pdf = await printToPdf(deps, html);

    // Nama berkas diturunkan dari `reportId`, bukan dibangkitkan: itu yang membuat job
    // yang diulang menimpa berkas yang sama alih-alih menumpuk duplikat.
    const fileRef = posix.join('reports', `${job.reportId}.pdf`);
    const absolute = join(deps.storagePath, fileRef);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, pdf);

    await reportReady(deps, job.reportId, fileRef);
    log.info({ fileRef, bytes: pdf.byteLength }, 'PDF laporan selesai');
  };
}

async function fetchPrintPage(deps: ReportPdfDeps, reportId: string): Promise<string> {
  const response = await fetch(`${deps.apiBaseUrl}/api/v1/internal/reports/${reportId}/print`, {
    headers: { authorization: `Bearer ${deps.internalToken}` },
    signal: AbortSignal.timeout(PRINT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`halaman cetak ${response.status}`);
  return response.text();
}

async function printToPdf(deps: ReportPdfDeps, html: string): Promise<Buffer> {
  const browser = await deps.launchBrowser();
  try {
    const page = await browser.newPage();
    try {
      // `setContent`, bukan `goto`: HTML-nya sudah ada di tangan, dan membuat Chromium
      // meminta ulang halamannya berarti rute internal dipanggil dua kali.
      await page.setContent(html, { waitUntil: 'load' });
      return await page.pdf({ format: 'A4', printBackground: true });
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function reportReady(deps: ReportPdfDeps, reportId: string, fileRef: string): Promise<void> {
  const response = await fetch(`${deps.apiBaseUrl}/api/v1/internal/reports/${reportId}/ready`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${deps.internalToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fileRef }),
  });
  if (!response.ok) throw new Error(`penandaan READY gagal: ${response.status}`);
}

/** Pembuat browser sungguhan. Dipisah supaya `reportPdfConsumer` bisa diuji tanpa Chromium. */
export async function launchChromium(): Promise<PrintableBrowser> {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  return {
    async newPage() {
      const page = await browser.newPage();
      return {
        setContent: (html, options) => page.setContent(html, options),
        pdf: async (options) =>
          Buffer.from(
            await page.pdf({ format: options.format, printBackground: options.printBackground }),
          ),
        close: () => page.close(),
      };
    },
    close: () => browser.close(),
  };
}
