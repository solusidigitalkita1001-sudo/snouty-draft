/**
 * `/projects/*` (P24-02, pemilik 2026-10-19: proyek ala Claude). Semua rute butuh akun
 * (`CONVERSATION_HISTORY`); kepemilikan diperiksa di `ProjectService`.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { requireEntitled } from '../../../shared/http/entitlement.js';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import {
  MAX_PROJECT_NAME,
  MAX_PROJECT_NOTES,
  ProjectService,
} from '../application/project.service.js';
import type { ProjectRow, ProjectWithCount } from '../domain/project.repository.js';
import { summaryOf } from './conversation.controller.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const CreateDto = z
  .object({
    name: z.string().trim().min(1).max(MAX_PROJECT_NAME),
    notes: z.string().max(MAX_PROJECT_NOTES).nullable().optional(),
  })
  .strict();
const PatchDto = z
  .object({
    name: z.string().trim().min(1).max(MAX_PROJECT_NAME).optional(),
    notes: z.string().max(MAX_PROJECT_NOTES).nullable().optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined || d.notes !== undefined);

@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Get()
  async list(@Req() request: PublicRequest) {
    const ownerId = accountOf(request);
    const rows = await this.projects.list(ownerId);
    return { items: rows.map(projectOf) };
  }

  @Audited(USER_AUDIT.projectCreate)
  @Post()
  async create(@Req() request: PublicRequest, @Body() body: unknown) {
    const ownerId = accountOf(request);
    const dto = parse(CreateDto, body ?? {});
    return projectOf(await this.projects.create(ownerId, dto.name, dto.notes ?? null));
  }

  @Get(':id')
  async find(@Param() params: unknown, @Req() request: PublicRequest) {
    const ownerId = accountOf(request);
    const { project, conversations } = await this.projects.find(idOf(params), ownerId);
    return { ...projectOf(project), conversations: conversations.map(summaryOf) };
  }

  @Audited(USER_AUDIT.projectUpdate)
  @Patch(':id')
  async update(@Param() params: unknown, @Req() request: PublicRequest, @Body() body: unknown) {
    const ownerId = accountOf(request);
    const dto = parse(PatchDto, body ?? {});
    const row = await this.projects.update(idOf(params), ownerId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
    return projectOf(row);
  }

  @Audited(USER_AUDIT.projectDelete)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param() params: unknown, @Req() request: PublicRequest): Promise<void> {
    await this.projects.remove(idOf(params), accountOf(request));
  }
}

/** Hanya akun: tamu ditolak `NOT_ENTITLED` lewat entitlement riwayat. */
function accountOf(request: PublicRequest): string {
  const actor = actorOf(request);
  requireEntitled(actor.tier, 'CONVERSATION_HISTORY');
  return actor.id;
}

function projectOf(row: ProjectRow | ProjectWithCount) {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    ...('conversationCount' in row ? { conversationCount: row.conversationCount } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function idOf(raw: unknown): string {
  const result = IdParam.safeParse(raw);
  if (!result.success) throw new RequestValidationError(['id']);
  return result.data.id;
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new RequestValidationError([
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'body')),
    ]);
  }
  return result.data;
}
