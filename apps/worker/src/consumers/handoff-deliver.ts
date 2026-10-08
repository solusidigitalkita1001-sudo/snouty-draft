/**
 * Konsumer `handoff.deliver` — mengirim kasus ke tim teknis Pralon lewat n8n (P10-06, OQ-08).
 *
 * Alur: ambil isi email dari API (`/internal/handoff-messages/:id`, token worker) → kirim ke
 * webhook n8n bersama alamat tujuan → n8n yang mengirim emailnya. Seperti konsumer PDF, worker
 * tidak menyentuh database dan tidak mengimpor `apps/api` (OQ-40).
 *
 * **Belum dikonfigurasi bukan kegagalan.** Tanpa URL webhook atau alamat tujuan, job dicatat
 * lalu selesai: barisnya tetap di antrean tim teknis (setengah lain dari OQ-08), dan mengulang
 * job yang tidak mungkin berhasil hanya mengisi DLQ. Kegagalan sungguhan — API atau n8n menjawab
 * galat — dilempar supaya transport mencoba lagi lalu memindahkannya ke DLQ.
 *
 * Tanda tangan sama dengan webhook masuk (docs/SECURITY.md §5): HMAC-SHA256 atas
 * `timestamp.rawBody`, di header `x-snouty-signature` dan `x-snouty-timestamp`, supaya alur n8n
 * bisa menolak permintaan yang bukan dari SNOUTY.
 */
import { createHmac } from 'node:crypto';
import type { HandoffDeliverJob } from '@snouty/jobs';
import type { Logger } from 'pino';
import type { ConsumerContext } from '../transport/rabbitmq.js';

const REQUEST_TIMEOUT_MS = 15_000;

export interface HandoffDeliverDeps {
  readonly apiBaseUrl: string;
  readonly internalToken: string;
  /** Kosong = belum dikonfigurasi: job dicatat lalu selesai. */
  readonly webhookUrl: string | undefined;
  readonly webhookSecret: string | undefined;
  readonly target: string | undefined;
  readonly log: Logger;
  /** Disuntikkan supaya konsumer bisa diuji tanpa jaringan. */
  readonly fetch?: typeof fetch;
  readonly nowSeconds?: () => number;
}

interface HandoffMessage {
  readonly handoffId: string;
  readonly conversationId: string;
  readonly subject: string;
  readonly text: string;
}

export function handoffDeliverConsumer(deps: HandoffDeliverDeps) {
  const http = deps.fetch ?? fetch;
  const now = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));

  return async function handle(job: HandoffDeliverJob, context: ConsumerContext): Promise<void> {
    const log = deps.log.child({ handoffId: job.handoffId, correlationId: context.correlationId });
    if (!deps.webhookUrl || !deps.target || !deps.webhookSecret) {
      log.warn('pengiriman handoff belum dikonfigurasi — kasus tetap di antrean tim teknis');
      return;
    }

    const response = await http(
      `${deps.apiBaseUrl}/api/v1/internal/handoff-messages/${encodeURIComponent(job.handoffId)}`,
      {
        headers: { authorization: `Bearer ${deps.internalToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) throw new Error(`isi handoff ${response.status}`);
    const message = (await response.json()) as HandoffMessage;

    const body = JSON.stringify({ to: deps.target, ...message });
    const timestamp = String(now());
    const signature = createHmac('sha256', deps.webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    const sent = await http(deps.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-snouty-timestamp': timestamp,
        'x-snouty-signature': signature,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!sent.ok) throw new Error(`webhook n8n ${sent.status}`);
    log.info('handoff terkirim ke tim teknis');
  };
}
