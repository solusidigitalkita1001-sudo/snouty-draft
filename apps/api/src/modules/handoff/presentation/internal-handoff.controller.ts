/**
 * `GET /internal/handoff-messages/:id` — isi email kasus untuk worker (P10-06, OQ-08).
 *
 * Terpisah dari controller publik karena alasan yang sama dengan rute cetak laporan: ia
 * mengembalikan kebutuhan pengguna **tanpa pemeriksaan pemilik** (pemanggilnya sistem), jadi
 * hanya token worker — lewat `WorkerTokenMiddleware` yang dipasang pada controller ini saja —
 * dan gerbang peran yang membukanya. Tanpa token di env, rutenya tertutup.
 */
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { InternalRoleGuard, RequiresRole } from '../../../shared/http/internal-role.guard.js';
import { HandoffService } from '../application/handoff.service.js';
import type { HandoffMessage } from '../domain/handoff-message.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();

@Controller('internal/handoff-messages')
@UseGuards(InternalRoleGuard)
export class InternalHandoffController {
  constructor(private readonly handoffs: HandoffService) {}

  @Get(':id')
  @RequiresRole(INTERNAL_ROLES.admin)
  async message(@Param() params: unknown): Promise<HandoffMessage> {
    const result = IdParam.safeParse(params);
    if (!result.success) throw new RequestValidationError(['id']);
    return this.handoffs.messageFor(result.data.id);
  }
}
