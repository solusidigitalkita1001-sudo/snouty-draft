import pino from 'pino';

/**
 * Worker RabbitMQ — terpisah dari API karena profil operasionalnya berbeda:
 * job panjang, memuat Chromium untuk PDF, dan tidak menerima trafik masuk.
 * Menggabungkannya berarti setiap replika API ikut membawa Chromium dan ikut
 * mengonsumsi antrean (docs/ARCHITECTURE.md §2).
 *
 * Konsumer pertama (report.generate) menyusul di Fase 10.
 */
const log = pino({ name: 'snouty-worker' });

function bootstrap(): void {
  log.info('SNOUTY worker siap — belum ada konsumer terdaftar');
}

bootstrap();
