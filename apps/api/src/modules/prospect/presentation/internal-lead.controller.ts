/**
 * Dashboard sales (P26-06): prospek milik sales, ringkasan percakapan, status, dan transkrip baca-saja.
 * Sales hanya melihat yang ditugaskan kepadanya; admin dan peninjau melihat semua (`canSeeLead`).
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
import { LeadService } from '../application/lead.service.js';
import type { InternalViewer } from '../domain/lead.js';
import { LEAD_STATUSES } from '../domain/prospect-board.js';
import { prospectDto } from './prospect.dto.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const TranscriptParam = z
  .object({ id: z.string().length(26), conversationId: z.string().length(26) })
  .strict();
const StatusDto = z
  .object({
    status: z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(255).optional(),
  })
  .strict();

const LEAD_ROLES = [
  INTERNAL_ROLES.sales,
  INTERNAL_ROLES.admin,
  INTERNAL_ROLES.salesReviewer,
] as const;

@Controller('internal/leads')
@UseGuards(InternalRoleGuard)
export class InternalLeadController {
  constructor(private readonly leads: LeadService) {}

  @Get('mine')
  @RequiresRole(...LEAD_ROLES)
  async mine(@Req() req: WithInternalActor) {
    return { items: (await this.leads.mine(viewerOf(req))).map(prospectDto) };
  }

  @Get(':id')
  @RequiresRole(...LEAD_ROLES)
  async detail(@Param() params: unknown, @Req() req: WithInternalActor) {
    const { id } = parse(IdParam, params);
    const { lead, prospect, facts } = await this.leads.detail(id, viewerOf(req));
    return {
      status: lead.status,
      lostReason: lead.lostReason,
      assignedAt: lead.assignedAt.toISOString(),
      context: lead.context,
      prospect: prospect && prospectDto(prospect),
      facts: {
        ...facts,
        projects: facts.projects.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
        salesRequest: facts.salesRequest && {
          source: facts.salesRequest.source,
          at: facts.salesRequest.at.toISOString(),
        },
        quotes: facts.quotes.map((q) => ({ text: q.text, at: q.at.toISOString() })),
      },
    };
  }

  @Audited(USER_AUDIT.leadStatus)
  @Post(':id/status')
  @HttpCode(204)
  @RequiresRole(...LEAD_ROLES)
  async status(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() req: WithInternalActor,
  ): Promise<void> {
    const { id } = parse(IdParam, params);
    const { status, lostReason } = parse(StatusDto, body);
    await this.leads.setStatus(id, viewerOf(req), status, lostReason ?? null);
  }

  @Post(':id/context')
  @RequiresRole(...LEAD_ROLES)
  async context(@Param() params: unknown, @Req() req: WithInternalActor) {
    const { id } = parse(IdParam, params);
    return { context: await this.leads.refreshContext(id, viewerOf(req)) };
  }

  /** Transkrip baca-saja; setiap pembukaan tercatat di jejak audit. */
  @Audited(USER_AUDIT.leadTranscript)
  @Get(':id/conversations/:conversationId')
  @RequiresRole(...LEAD_ROLES)
  async transcript(@Param() params: unknown, @Req() req: WithInternalActor) {
    const { id, conversationId } = parse(TranscriptParam, params);
    const lines = await this.leads.transcript(id, conversationId, viewerOf(req));
    return { items: lines.map((l) => ({ role: l.role, text: l.text, at: l.at.toISOString() })) };
  }
}

function viewerOf(req: WithInternalActor): InternalViewer {
  const actor = req.internalActor;
  if (actor === undefined) throw new UnauthenticatedError();
  return { id: actor.id, roles: actor.roles };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new RequestValidationError(result.error.issues.map((i) => i.path.join('.') || 'body'));
  }
  return result.data;
}
