/** `GET /internal/market` — agregat pasar untuk dashboard admin (P26-07, docs/MARKET_INTELLIGENCE.md §7). */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { INTERNAL_ROLES } from '../../../shared/auth/roles.js';
import { RequestValidationError } from '../../../shared/http/api-errors.js';
import { InternalRoleGuard, RequiresRole } from '../../../shared/http/internal-role.guard.js';
import { MarketEventService } from '../application/market-event.service.js';

const DashboardQuery = z
  .object({ days: z.coerce.number().int().min(7).max(730).default(90) })
  .strict();

@Controller('internal/market')
@UseGuards(InternalRoleGuard)
export class InternalMarketController {
  constructor(private readonly market: MarketEventService) {}

  @Get()
  @RequiresRole(INTERNAL_ROLES.admin, INTERNAL_ROLES.salesReviewer)
  async dashboard(@Query() query: unknown) {
    const parsed = DashboardQuery.safeParse(query ?? {});
    if (!parsed.success) throw new RequestValidationError(['days']);
    return this.market.dashboard(parsed.data.days);
  }
}
