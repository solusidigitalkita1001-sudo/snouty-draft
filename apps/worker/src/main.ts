import pino from 'pino';
import { QUEUES, type HandoffDeliverJob, type ReportGenerateJob } from '@snouty/jobs';
import { handoffDeliverConsumer } from './consumers/handoff-deliver.js';
import { launchChromium, reportPdfConsumer } from './consumers/report-pdf.js';
import { RabbitTransport } from './transport/rabbitmq.js';

/**
 * Worker RabbitMQ — terpisah dari API karena profil operasionalnya berbeda: job panjang,
 * memuat Chromium untuk PDF, dan tidak menerima trafik masuk. Menggabungkannya berarti
 * setiap replika API ikut membawa Chromium dan ikut mengonsumsi antrean
 * (docs/ARCHITECTURE.md §2).
 *
 * Worker **tidak pernah mengimpor `apps/api`** dan tidak memegang kredensial database
 * (OQ-40). Ia meminta HTML dari API, mencetak, lalu melaporkan hasilnya lewat API.
 */
const log = pino({ name: 'snouty-worker' });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    // Gagal saat start, bukan saat job pertama tiba: worker yang berjalan tanpa konfigurasi
    // akan terlihat sehat sampai ada pekerjaan, lalu gagal berulang-ulang ke DLQ.
    throw new Error(`${name} wajib diset`);
  }
  return value;
}

async function bootstrap(): Promise<void> {
  const transport = new RabbitTransport(
    process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@127.0.0.1:5673',
    log,
  );
  await transport.start();

  const handler = reportPdfConsumer({
    apiBaseUrl: requireEnv('API_URL'),
    internalToken: requireEnv('WORKER_INTERNAL_TOKEN'),
    storagePath: requireEnv('STORAGE_PATH'),
    log,
    launchBrowser: launchChromium,
  });

  await transport.consume<ReportGenerateJob>(QUEUES.reportGenerate, handler);

  // Pengiriman kasus ke tim teknis (P10-06, OQ-08). Konfigurasi n8n opsional: tanpa itu
  // job dicatat lalu selesai, dan kasusnya tetap di antrean tim teknis.
  await transport.consume<HandoffDeliverJob>(
    QUEUES.handoffDeliver,
    handoffDeliverConsumer({
      apiBaseUrl: requireEnv('API_URL'),
      internalToken: requireEnv('WORKER_INTERNAL_TOKEN'),
      webhookUrl: process.env['N8N_HANDOFF_WEBHOOK_URL'],
      webhookSecret: process.env['N8N_WEBHOOK_SECRET'],
      target: process.env['TECH_HANDOFF_TARGET'],
      log,
    }),
  );
  log.info('SNOUTY worker siap');

  const shutdown = (signal: string): void => {
    log.info({ signal }, 'worker berhenti');
    void transport.stop().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err: unknown) => {
  log.error({ err }, 'worker gagal start');
  process.exit(1);
});
