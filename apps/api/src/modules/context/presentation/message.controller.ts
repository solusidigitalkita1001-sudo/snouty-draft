/**
 * `POST /conversations/:id/messages` — giliran chat, balasan SSE.
 * docs/API_CONTRACTS.md §2, §3.
 *
 * SSE bukan `@Sse()` Nest (yang berorientasi GET + Observable): giliran ini punya
 * body (pesan), jadi responsnya ditulis manual sebagai `event:`/`data:`. Kepemilikan
 * percakapan diperiksa di service (lapis application).
 */
import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AssistantStreamEvent } from '@snouty/shared-types';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RateLimitedError, RequestValidationError } from '../../../shared/http/api-errors.js';
import { limitFor } from '../../policy/rate-limits.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { MessageService } from '../application/message.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const MessageDto = z.object({ text: z.string().trim().min(1).max(4_000) }).strict();

@Controller('conversations')
export class MessageController {
  constructor(
    private readonly messages: MessageService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  @Post(':id/messages')
  async send(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: PublicRequest,
    @Res() res: Response,
  ): Promise<void> {
    const id = parse(IdParam, params).id;
    const { text } = parse(MessageDto, body);
    const actor = actorOf(req);

    // Batas pesan per tier (docs/POLICY.md §10). Diperiksa SEBELUM header SSE ditulis:
    // begitu respons menjadi stream, satu-satunya cara melaporkan penolakan adalah event
    // `error` — dan kode status 429 yang jujur lebih berguna bagi klien.
    const limit = limitFor(actor.tier, 'messages_per_hour');
    if (limit) {
      const verdict = await this.rateLimiter.consume(
        'messages',
        `${actor.kind}:${actor.id}`,
        limit,
      );
      if (!verdict.allowed) {
        throw new RateLimitedError(verdict.retryAfterSec);
      }
    }

    /**
     * Pekerjaan dijalankan **sebelum** satu byte header pun ditulis.
     *
     * Sebelumnya header SSE di-flush lebih dulu, dan akibatnya setiap galat setelah itu
     * tidak bisa dilaporkan: filter galat mencoba `response.json()` atas respons yang
     * headernya sudah terkirim, gagal, dan koneksi tertutup tanpa isi. Yang terlihat di
     * browser adalah `ERR_EMPTY_RESPONSE` — tanpa petunjuk apa pun tentang sebabnya.
     *
     * Giliran chat tidak streaming token dari model (prosa penjelas datang di Fase 7 lewat
     * jalur lain), jadi menunggu pekerjaan selesai tidak menghilangkan apa pun yang
     * sebenarnya progresif — dan menukar "respons kosong yang tak bisa didiagnosis"
     * dengan galat yang terbaca adalah pertukaran yang jelas menguntungkan.
     */
    const now = new Date().toISOString();
    const events = await this.messages.handle(id, actor, text, now);

    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('connection', 'keep-alive');
    res.flushHeaders?.();

    for (const event of events) writeEvent(res, event);
    res.end();
  }
}

function writeEvent(res: Response, event: AssistantStreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
