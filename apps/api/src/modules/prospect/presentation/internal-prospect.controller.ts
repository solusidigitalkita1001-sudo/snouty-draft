/**
 * Dashboard admin (P26-05, docs/PROSPECT_5A.md §4): papan prospek 5A, penugasan ke sales, dan tim sales.
 * `admin` dan `sales_reviewer` melihat semua dan menugaskan; menambah/mencabut anggota tim hanya `admin`.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError, UnauthenticatedError } from '../../../shared/http/api-errors.js';
import {
  InternalRoleGuard,
  RequiresRole,
  type WithInternalActor,
} from '../../../shared/http/internal-role.guard.js';
import { ProspectBoardService } from '../application/prospect-board.service.js';
import type { ProspectRow } from '../domain/prospect-board.js';
import { STAGES } from '../domain/prospect-stage.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const BoardQuery = z
  .object({
    stage: z.enum(STAGES).optional(),
    priority: z.enum(['hot', 'warm', 'cold']).optional(),
    scale: z.enum(['house', 'building', 'district']).optional(),
    assignment: z.enum(['assigned', 'unassigned']).optional(),
    q: z.string().max(120).optional(),
  })
  .strict();
const AssignDto = z.object({ salesUserId: z.string().length(26) }).strict();
const GrantDto = z.object({ email: z.string().email().max(255) }).strict();

const BOARD_ROLES = [INTERNAL_ROLES.admin, INTERNAL_ROLES.salesReviewer] as const;

@Controller('internal')
@UseGuards(InternalRoleGuard)
export class InternalProspectController {
  constructor(private readonly board: ProspectBoardService) {}

  @Get('prospects')
  @RequiresRole(...BOARD_ROLES)
  async list(@Query() query: unknown) {
    const filter = parse(BoardQuery, query);
    const result = await this.board.board(filter);
    return { funnel: result.funnel, items: result.items.map(toDto) };
  }

  @Audited(USER_AUDIT.prospectAssign)
  @Post('prospects/:id/assign')
  @HttpCode(204)
  @RequiresRole(...BOARD_ROLES)
  async assign(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: WithInternalActor,
  ): Promise<void> {
    const { id } = parse(IdParam, params);
    const { salesUserId } = parse(AssignDto, body);
    await this.board.assign(id, salesUserId, actorId(req));
  }

  @Get('sales-team')
  @RequiresRole(...BOARD_ROLES)
  async team() {
    return { items: await this.board.salesTeam() };
  }

  @Audited(USER_AUDIT.salesGrant)
  @Post('sales-team')
  @HttpCode(204)
  @RequiresRole(INTERNAL_ROLES.admin)
  async grant(@Body() body: unknown, @Req() req: WithInternalActor): Promise<void> {
    const { email } = parse(GrantDto, body);
    await this.board.addSales(email, actorId(req));
  }

  @Audited(USER_AUDIT.salesRevoke)
  @Delete('sales-team/:id')
  @HttpCode(204)
  @RequiresRole(INTERNAL_ROLES.admin)
  async revoke(@Param() params: unknown): Promise<void> {
    const { id } = parse(IdParam, params);
    await this.board.removeSales(id);
  }
}

function toDto(row: ProspectRow) {
  return {
    userId: row.user.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    registeredAt: row.user.createdAt.toISOString(),
    stage: row.stage,
    stageReachedAt: row.stageReachedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    scale: row.scale,
    score: row.score,
    priority: row.priority,
    salesContactConsent: row.salesContactConsent,
    salesRequestedAt: row.salesRequestedAt?.toISOString() ?? null,
    contactable: row.contactable,
    conversationCount: row.conversationCount,
    lead: row.lead && {
      salesUserId: row.lead.salesUserId,
      salesName: row.lead.salesName,
      status: row.lead.status,
      assignedAt: row.lead.assignedAt.toISOString(),
    },
  };
}

function actorId(req: WithInternalActor): string {
  const actor = req.internalActor;
  if (actor === undefined) throw new UnauthenticatedError();
  return actor.id;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
