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
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { MessageService } from '../application/message.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const MessageDto = z.object({ text: z.string().trim().min(1).max(4_000) }).strict();

@Controller('conversations')
export class MessageController {
  constructor(private readonly messages: MessageService) {}

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

    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('connection', 'keep-alive');
    res.flushHeaders?.();

    const now = new Date().toISOString();
    const events = await this.messages.handle(id, actor, text, now);
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
