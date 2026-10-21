/**
 * `POST /conversations/:id/contact-request` — "Minta dihubungi tim Pralon" (P26-04). Hanya pengguna
 * terdaftar (OQ-76): tamu menerima NOT_ENTITLED, klien menampilkan ajakan daftar, lalu permintaannya
 * diteruskan setelah masuk.
 */
import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { requireEntitled } from '../../../shared/http/entitlement.js';
import { SalesRequestService } from '../application/sales-request.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const RequestDto = z.object({ source: z.enum(['solution', 'price']) }).strict();

@Controller('conversations')
export class SalesRequestController {
  constructor(private readonly requests: SalesRequestService) {}

  @Audited(USER_AUDIT.salesRequest)
  @Post(':id/contact-request')
  async create(@Param() params: unknown, @Body() body: unknown, @Req() req: PublicRequest) {
    const actor = actorOf(req);
    requireEntitled(actor.tier, 'CONTACT_SALES');
    const id = parse(IdParam, params).id;
    const { source } = parse(RequestDto, body);
    const { row, repeated } = await this.requests.request(id, actor, source);
    return { id: row.id, createdAt: row.createdAt.toISOString(), repeated };
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
