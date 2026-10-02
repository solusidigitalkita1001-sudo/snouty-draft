/**
 * Publisher job RabbitMQ. P1-06b · OQ-40.
 *
 * Kontrak dari `@snouty/jobs` — paket yang sama yang dipakai worker, jadi payload tidak bisa
 * menyimpang antara yang dikirim dan yang diharapkan.
 *
 * **Kegagalan antrean tidak menjatuhkan permintaan pengguna.** Laporan yang gagal
 * di-enqueue tetap ada sebagai baris `PENDING` dengan nomor yang sudah dialokasikan, dan
 * bisa dicoba lagi tanpa pengguna mengetik apa pun (docs/REPORT.md §6). Memilih sebaliknya
 * berarti RabbitMQ mati = tombol "Buat laporan" mati, padahal datanya sudah lengkap.
 */

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { connect, type Channel, type ChannelModel } from 'amqplib';
import { CONTRACT_VERSION, deadLetterQueueOf, QUEUES, type QueueName } from '@snouty/jobs';
import { loadEnv } from '../../config/env.js';
import { LoggerService } from '../logging/logger.service.js';

@Injectable()
export class JobPublisher implements OnModuleDestroy {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly log;

  constructor(logger: LoggerService) {
    this.log = logger.child({ module: 'queue' });
  }

  /**
   * Mengirim job. Mengembalikan `false` bila antrean tidak tersedia — pemanggil memutuskan
   * apa artinya, dan untuk laporan artinya "tetap PENDING, bisa dicoba lagi".
   */
  async publish(queue: QueueName, payload: Record<string, unknown>): Promise<boolean> {
    try {
      const channel = await this.ensureChannel();
      const body = Buffer.from(
        JSON.stringify({ ...payload, contractVersion: CONTRACT_VERSION }),
        'utf8',
      );
      return channel.sendToQueue(queue, body, { persistent: true });
    } catch (err) {
      this.log.error({ queue, err }, 'gagal mengirim job ke antrean');
      return false;
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) return this.channel;

    const env = loadEnv();
    this.connection = await connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    // Antrean dideklarasikan publisher DAN konsumer: siapa pun yang start lebih dulu
    // membuatnya, dan deklarasi yang identik bersifat idempoten di RabbitMQ.
    for (const queue of Object.values(QUEUES)) {
      await this.channel.assertQueue(deadLetterQueueOf(queue), { durable: true });
      await this.channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: deadLetterQueueOf(queue),
      });
    }

    return this.channel;
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}
