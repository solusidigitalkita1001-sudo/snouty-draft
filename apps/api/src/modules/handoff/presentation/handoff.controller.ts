/**
 * `POST /conversations/:id/handoff` — "Kirim ke tim teknis Pralon" (layar 11).
 *
 * Tidak digerbang entitlement: menyerahkan kasus yang di luar cakupan justru paling
 * dibutuhkan pengguna yang tidak punya akun, dan menutupnya akan membuat jalan keluar
 * dari layar 11 hanya tersedia bagi yang mendaftar.
 */
import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { HandoffService } from '../application/handoff.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const HandoffDto = z.object({ reason: z.string().trim().min(1).max(255) }).strict();

@Controller('conversations')
export class HandoffController {
  constructor(private readonly handoffs: HandoffService) {}

  @Post(':id/handoff')
  async enqueue(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: PublicRequest,
  ): Promise<unknown> {
    const id = parse(IdParam, params).id;
    const { reason } = parse(HandoffDto, body);
    const row = await this.handoffs.enqueue(id, actorOf(req), reason);
    return {
      id: row.id,
      status: row.status,
      capturedCount: row.captured.length,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
