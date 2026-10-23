/**
 * `/notifications` (P27-07) — milik akun yang sedang masuk, dan hanya miliknya. Tidak ada
 * parameter "untuk siapa": memberi tahu atas nama orang lain, atau membaca pemberitahuan orang
 * lain, bukan fitur.
 */
import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';

import {
  NotEntitledCapabilityError,
  RequestValidationError,
} from '../../../shared/http/api-errors.js';
import { NotificationService } from '../application/notification.service.js';

const ReadDto = z.object({ ids: z.array(z.string().length(26)).max(100).optional() }).strict();

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(@Req() req: PublicRequest) {
    const userId = accountOf(req);
    const [items, unread] = await Promise.all([
      this.notifications.list(userId),
      this.notifications.unreadCount(userId),
    ]);
    return {
      unread,
      items: items.map((row) => ({
        id: row.id,
        kind: row.kind,
        subjectId: row.subjectId,
        data: row.data,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /** Tanpa `ids`: semuanya. Dengan `ids`: hanya itu, dan hanya bila memang miliknya. */
  @Post('read')
  @HttpCode(204)
  async markRead(@Body() body: unknown, @Req() req: PublicRequest): Promise<void> {
    const { ids } = parse(ReadDto, body ?? {});
    await this.notifications.markRead(accountOf(req), ids ?? []);
  }
}

/** Pemberitahuan punya akun; tamu tidak punya tempat untuk menerimanya. */
function accountOf(req: PublicRequest): string {
  const actor = actorOf(req);
  if (actor.kind !== 'user') throw new NotEntitledCapabilityError('NOTIFICATIONS');
  return actor.id;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
