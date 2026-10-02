/**
 * `/onboarding/*` dan `/consents` — docs/API_CONTRACTS.md §2.
 *
 * Subjeknya aktor permintaan: user ber-token atau tamu ber-cookie. Tidak ada
 * endpoint yang menerima subjek dari body — consent atas nama orang lain bukan
 * fitur.
 */
import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import { onboardingBenefits } from '../../policy/entitlements.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { ConsentService } from '../application/consent.service.js';
import { OnboardingService } from '../application/onboarding.service.js';
import type { ConsentSubject } from '../domain/consent.repository.js';

const CompleteDto = z.object({ outcome: z.enum(['done', 'guest', 'skip']) }).strict();
const ConsentDto = z
  .object({
    kind: z.enum(['LOCATION', 'ANALYTICS_STORAGE']),
    granted: z.boolean(),
  })
  .strict();

@Controller()
export class OnboardingConsentController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly consents: ConsentService,
  ) {}

  @Get('onboarding/state')
  async state(@Req() request: PublicRequest) {
    return { state: await this.onboarding.state(subjectOf(request)) };
  }

  @Post('onboarding/complete')
  @HttpCode(204)
  async complete(@Body() rawBody: unknown, @Req() request: PublicRequest): Promise<void> {
    const body = parse(CompleteDto, rawBody);
    await this.onboarding.complete(subjectOf(request), body.outcome);
  }

  /** Dibangkitkan dari ENTITLEMENTS — UI tidak pernah menuliskannya sendiri (SPEC §33e). */
  @Get('onboarding/benefits')
  benefits() {
    return { items: onboardingBenefits() };
  }

  @Post('consents')
  @HttpCode(204)
  async record(@Body() rawBody: unknown, @Req() request: PublicRequest): Promise<void> {
    const body = parse(ConsentDto, rawBody);
    await this.consents.record(subjectOf(request), body.kind, body.granted);
  }

  @Get('consents')
  async current(@Req() request: PublicRequest) {
    return { items: await this.consents.current(subjectOf(request)) };
  }
}

function subjectOf(request: PublicRequest): ConsentSubject {
  const actor = actorOf(request);
  return { kind: actor.kind, id: actor.id };
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
