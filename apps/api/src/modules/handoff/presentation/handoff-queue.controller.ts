/**
 * Antrean teknis yang bisa dilihat dan dikerjakan (P29-01, docs/BACKOFFICE.md §4.3).
 *
 * Kasus dari "Kirim ke tim teknis Pralon" sudah tersimpan sejak P8-07, tetapi tidak ada satu
 * pun rute yang membacanya selain rute worker — jadi tidak ada orang Pralon yang pernah bisa
 * melihat antreannya. Selama tujuan email belum diisi (OQ-08), layar inilah **satu-satunya**
 * jalan kasus itu sampai ke manusia.
 *
 * Terpisah dari `InternalHandoffController`: yang itu dipagari token worker dan mengembalikan
 * isi email, yang ini dipagari peran manusia.
 */
import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError, UnauthenticatedError } from '../../../shared/http/api-errors.js';
import {
  InternalRoleGuard,
  RequiresRole,
  type WithInternalActor,
} from '../../../shared/http/internal-role.guard.js';
import { HandoffService, type HandoffBoardItem } from '../application/handoff.service.js';
import { HANDOFF_STATUSES } from '../domain/handoff.repository.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const StatusDto = z.object({ status: z.enum(HANDOFF_STATUSES) }).strict();

/** Tim teknis mengerjakannya; admin melihatnya karena ialah yang ditanya saat kasus menumpuk. */
const QUEUE_ROLES = [INTERNAL_ROLES.technicalTeam, INTERNAL_ROLES.admin] as const;

@Controller('internal/handoff')
@UseGuards(InternalRoleGuard)
export class HandoffQueueController {
  constructor(private readonly handoffs: HandoffService) {}

  @Get()
  @RequiresRole(...QUEUE_ROLES)
  async board() {
    const board = await this.handoffs.board();
    return {
      open: board.open.map(itemDto),
      closed: board.closed.map(itemDto),
      slaHours: board.slaHours,
    };
  }

  @Audited(USER_AUDIT.handoffStatus)
  @Post(':id/status')
  @HttpCode(204)
  @RequiresRole(...QUEUE_ROLES)
  async setStatus(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: WithInternalActor,
  ): Promise<void> {
    const { id } = parse(IdParam, params);
    const { status } = parse(StatusDto, body);
    await this.handoffs.changeStatus(id, status, actorOf(req).id);
  }
}

function itemDto(item: HandoffBoardItem) {
  return {
    id: item.id,
    reason: item.reason,
    captured: item.captured,
    status: item.status,
    submitter: item.submitter,
    createdAt: item.createdAt.toISOString(),
    dueAt: item.dueAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
    overdue: item.overdue,
  };
}

function actorOf(req: WithInternalActor) {
  const actor = req.internalActor;
  if (actor === undefined) throw new UnauthenticatedError();
  return actor;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
