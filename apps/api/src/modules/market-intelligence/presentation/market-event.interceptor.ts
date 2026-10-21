/**
 * Mencatat event pasar setelah rute ber-`@RecordsMarketEvent` berhasil (P26-07). Tidak menunggu dan
 * tidak pernah menggagalkan permintaan; IP permintaan hanya diteruskan ke pencarian provinsi.
 */
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { tap, type Observable } from 'rxjs';
import { MARKET_SIGNAL, type MarketSignalSpec } from '../../../shared/market/market-signal.js';
import { MarketEventService } from '../application/market-event.service.js';

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

@Injectable()
export class MarketEventInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly market: MarketEventService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<MarketSignalSpec | undefined>(
      MARKET_SIGNAL,
      context.getHandler(),
    );
    if (spec === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap(() => {
        const id = request.params?.[spec.param];
        if (typeof id === 'string' && ULID.test(id)) {
          void this.market.record(id, spec.trigger, request.ip);
        }
      }),
    );
  }
}
