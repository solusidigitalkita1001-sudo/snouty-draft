/**
 * Layar validasi aturan teknik (P31-82, OQ-06/P16-69).
 *
 * Dipagari `domain_expert` — ialah yang menandatangani — dan `admin`, yang perlu melihat
 * berapa yang sudah ditandatangani tanpa boleh ikut menandatangani. Pemisahannya ada di
 * dekorator tiap rute, bukan di satu daftar peran untuk seluruh controller: membaca dan
 * menandatangani bukan wewenang yang sama.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LOCALES, localeFromAcceptLanguage } from '@snouty/shared-types';
import type { Request } from 'express';
import { z } from 'zod';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import {
  RequestValidationError,
  UnauthenticatedError,
} from '../../../shared/http/api-errors.js';
import {
  InternalRoleGuard,
  RequiresRole,
  type WithInternalActor,
} from '../../../shared/http/internal-role.guard.js';
import { RULE_SIGN_OFF_DECISIONS } from '../domain/rule-sign-off.repository.js';
import { RuleValidationService } from '../application/rule-validation.service.js';

const RuleParam = z
  .object({ ruleId: z.string().min(3).max(16), version: z.coerce.number().int().min(1).max(999) })
  .strict();

const DecisionDto = z
  .object({
    decision: z.enum(RULE_SIGN_OFF_DECISIONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  // Menolak sebuah aturan menghentikan angkanya di seluruh layar. Alasannya wajib: tanpa itu,
  // yang memperbaiki formulanya kelak tidak tahu apa yang dianggap salah.
  .refine((dto) => dto.decision !== 'rejected' || (dto.note ?? '') !== '', {
    path: ['note'],
  });

const LocaleQuery = z.object({ locale: z.enum(LOCALES).optional() }).strict();

@Controller('internal/rules')
@UseGuards(InternalRoleGuard)
export class RuleValidationController {
  constructor(private readonly rules: RuleValidationService) {}

  @Get()
  @RequiresRole(INTERNAL_ROLES.domainExpert, INTERNAL_ROLES.admin)
  async board(@Query() query: unknown, @Req() request: Request) {
    const { locale } = parse(LocaleQuery, query);
    return this.rules.board(locale ?? localeFromAcceptLanguage(request.headers['accept-language']));
  }

  @Audited(USER_AUDIT.ruleDecision)
  @Post(':ruleId/:version/decision')
  @HttpCode(204)
  @RequiresRole(INTERNAL_ROLES.domainExpert)
  async decide(
    @Param() params: unknown,
    @Body() body: unknown,
    @Req() request: WithInternalActor,
  ): Promise<void> {
    const { ruleId, version } = parse(RuleParam, params);
    const { decision, note } = parse(DecisionDto, body);
    const result = await this.rules.decide({
      ruleId,
      ruleVersion: version,
      decision,
      note: note ?? null,
      actorId: actorOf(request).id,
    });
    if (result === 'unknown_rule') throw new NotFoundException();
    // Formulanya berubah di antara layar dibuka dan tombol ditekan: yang dibaca bukan yang ini.
    if (result === 'stale_version') throw new RequestValidationError(['version']);
  }

  @Audited(USER_AUDIT.ruleDecision)
  @Delete(':ruleId/:version/decision')
  @HttpCode(204)
  @RequiresRole(INTERNAL_ROLES.domainExpert)
  async withdraw(@Param() params: unknown): Promise<void> {
    const { ruleId, version } = parse(RuleParam, params);
    await this.rules.withdraw(ruleId, version);
  }
}

function actorOf(request: WithInternalActor) {
  const actor = request.internalActor;
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
