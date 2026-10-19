/**
 * Tautan bagikan (P24-03). Membuat, melihat status, dan mencabut: akun pemilik saja
 * (`SAVE_SOLUTION`). Membuka tautan: publik, dibatasi per IP supaya token tidak bisa ditebak beruntun.
 */
import { Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { actorOf, type PublicRequest } from '../../../shared/http/actor.js';
import { RateLimitedError, RequestValidationError } from '../../../shared/http/api-errors.js';
import { requireEntitled } from '../../../shared/http/entitlement.js';
import { Audited, USER_AUDIT } from '../../../shared/audit/audited.js';
import { RateLimiter } from '../../../shared/rate-limit/rate-limiter.js';
import { SHARED_VIEW_IP_LIMIT } from '../../policy/rate-limits.js';
import { ShareService } from '../application/share.service.js';

const IdParam = z.object({ id: z.string().length(26) }).strict();
const TokenParam = z.object({ token: z.string().min(1).max(64) }).strict();

@Controller()
export class ShareController {
  constructor(
    private readonly shares: ShareService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  @Audited(USER_AUDIT.shareCreate)
  @Post('recommendations/:id/share')
  async create(@Param() params: unknown, @Req() request: PublicRequest) {
    const actor = actorOf(request);
    requireEntitled(actor.tier, 'SAVE_SOLUTION');
    return this.shares.create(idOf(params), actor);
  }

  @Get('recommendations/:id/share')
  async status(@Param() params: unknown, @Req() request: PublicRequest) {
    const actor = actorOf(request);
    requireEntitled(actor.tier, 'SAVE_SOLUTION');
    return this.shares.status(idOf(params), actor);
  }

  @Audited(USER_AUDIT.shareRevoke)
  @Delete('recommendations/:id/share')
  @HttpCode(204)
  async revoke(@Param() params: unknown, @Req() request: PublicRequest): Promise<void> {
    const actor = actorOf(request);
    requireEntitled(actor.tier, 'SAVE_SOLUTION');
    await this.shares.revoke(idOf(params), actor);
  }

  @Get('shared/:token')
  async view(@Param() params: unknown, @Req() request: Request) {
    const verdict = await this.rateLimiter.consume(
      'shared:view',
      request.ip ?? 'tidak-diketahui',
      SHARED_VIEW_IP_LIMIT,
    );
    if (!verdict.allowed) throw new RateLimitedError(verdict.retryAfterSec);
    const parsed = TokenParam.safeParse(params);
    if (!parsed.success) throw new RequestValidationError(['token']);
    return this.shares.resolve(parsed.data.token);
  }
}

function idOf(raw: unknown): string {
  const result = IdParam.safeParse(raw);
  if (!result.success) throw new RequestValidationError(['id']);
  return result.data.id;
}
