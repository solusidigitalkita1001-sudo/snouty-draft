/**
 * Transport RabbitMQ untuk worker. Menjawab **OQ-40** dan **P1-06b**.
 *
 * Kontraknya datang dari `@snouty/jobs`, bukan dari `apps/api` — worker tidak pernah
 * mengimpor API. Lihat alasan lengkapnya di paket itu.
 *
 * Tiga hal yang membuat konsumer ini layak dipercaya di produksi:
 *
 * **Prefetch 1.** Satu job per worker sekaligus. Job PDF memuat Chromium dan memakan
 * memori; mengambil sepuluh sekaligus berarti sepuluh Chromium dan satu proses mati.
 *
 * **Validasi sebelum pekerjaan.** Pesan datang dari antrean, dan antrean bisa menyimpan
 * pesan dari versi kode yang lebih lama. Payload yang tidak lolos skema langsung ke DLQ —
 * mengulangnya tidak akan membuatnya valid, jadi backoff hanya menunda hal yang pasti.
 *
 * **DLQ, bukan `nack` tanpa batas.** Job yang gagal selamanya tidak boleh memblokir
 * antrean, dan job yang hilang tanpa jejak tidak bisa diperbaiki.
 */

import { connect, type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import {
  backoffFor,
  deadLetterQueueOf,
  JOB_SCHEMA,
  RETRY_POLICY,
  type QueueName,
} from '@snouty/jobs';
import type { Logger } from 'pino';

export interface ConsumerContext {
  readonly correlationId: string;
  readonly attempt: number;
}

export type JobHandler<T> = (payload: T, context: ConsumerContext) => Promise<void>;

/** Jumlah percobaan dibaca dari header; pesan pertama belum punya header ini. */
const ATTEMPT_HEADER = 'x-snouty-attempt';

export class RabbitTransport {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly url: string,
    private readonly log: Logger,
  ) {}

  async start(): Promise<void> {
    this.connection = await connect(this.url);
    this.channel = await this.connection.createChannel();
    // Satu job sekaligus per worker — lihat catatan prefetch di atas.
    await this.channel.prefetch(1);
  }

  /**
   * Mendaftarkan konsumer untuk satu antrean. Skema dipilih dari peta di `@snouty/jobs`,
   * jadi pemanggil tidak bisa memasangkan antrean dengan validator yang salah.
   */
  async consume<T>(queue: QueueName, handler: JobHandler<T>): Promise<void> {
    const channel = this.requireChannel();
    const dlq = deadLetterQueueOf(queue);

    await channel.assertQueue(dlq, { durable: true });
    await channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: dlq,
    });

    await channel.consume(queue, (message) => {
      void this.handleMessage(queue, message, handler);
    });

    this.log.info({ queue, dlq }, 'konsumer terdaftar');
  }

  private async handleMessage<T>(
    queue: QueueName,
    message: ConsumeMessage | null,
    handler: JobHandler<T>,
  ): Promise<void> {
    if (message === null) return;
    const channel = this.requireChannel();
    const attempt = Number(message.properties.headers?.[ATTEMPT_HEADER] ?? 1);

    let payload: T;
    try {
      const raw: unknown = JSON.parse(message.content.toString('utf8'));
      payload = JOB_SCHEMA[queue].parse(raw) as T;
    } catch (err) {
      // Payload tidak valid tidak akan menjadi valid setelah ditunggu. Langsung DLQ.
      this.log.error({ queue, err }, 'payload job tidak valid — ke DLQ tanpa percobaan ulang');
      channel.nack(message, false, false);
      return;
    }

    const correlationId =
      (payload as { correlationId?: string }).correlationId ?? 'tidak-diketahui';

    try {
      await handler(payload, { correlationId, attempt });
      channel.ack(message);
      this.log.info({ queue, correlationId, attempt }, 'job selesai');
    } catch (err) {
      if (attempt >= RETRY_POLICY.maxAttempts) {
        this.log.error({ queue, correlationId, attempt, err }, 'job gagal final — ke DLQ');
        channel.nack(message, false, false);
        return;
      }

      // Publikasi ulang dengan jeda, bukan `nack(requeue)`: requeue segera akan memutar
      // job yang gagal secepat mungkin dan mengubah satu kegagalan menjadi badai.
      const delay = backoffFor(attempt);
      this.log.warn({ queue, correlationId, attempt, delay, err }, 'job gagal — dicoba lagi');
      channel.ack(message);
      setTimeout(() => {
        void this.republish(queue, message.content, attempt + 1);
      }, delay);
    }
  }

  private async republish(queue: QueueName, content: Buffer, attempt: number): Promise<void> {
    try {
      this.requireChannel().sendToQueue(queue, content, {
        persistent: true,
        headers: { [ATTEMPT_HEADER]: attempt },
      });
    } catch (err) {
      // Kanal sudah tertutup (worker sedang berhenti). Pesannya hilang, dan itu lebih baik
      // daripada melempar dari dalam timer yang tidak punya penangkap.
      this.log.error({ queue, attempt, err }, 'gagal mempublikasikan ulang job');
    }
  }

  async stop(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
    this.channel = null;
    this.connection = null;
  }

  private requireChannel(): Channel {
    if (!this.channel) throw new Error('transport belum dijalankan');
    return this.channel;
  }
}
