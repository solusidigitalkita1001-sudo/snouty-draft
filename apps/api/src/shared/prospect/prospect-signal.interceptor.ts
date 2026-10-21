/**
 * Mencatat endpoint ber-`@RecordsSignal` ke `prospect_signals` setelah berhasil. Seperti jejak audit,
 * pencatatan **tidak pernah** menggagalkan atau menahan permintaan: tulis yang gagal hanya dicatat di log.
 * Kejadian yang sama di hari yang sama diabaikan (`dedupe_key` unik, insert-or-ignore).
 */
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap, type Observable } from 'rxjs';
import { prospectSignals } from '../../infrastructure/mysql/schema/intelligence.js';
import { DatabaseService } from '../database/database.service.js';
import type { PublicRequest } from '../http/actor.js';
import { LoggerService } from '../logging/logger.service.js';
import { ulid } from '../ulid.js';
import { RECORDS_SIGNAL, signalRowOf, type SignalRow, type SignalSpec } from './prospect-signal.js';

@Injectable()
export class ProspectSignalInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<SignalSpec | undefined>(RECORDS_SIGNAL, context.getHandler());
    if (spec === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<PublicRequest>();
    return next.handle().pipe(
      tap(() => {
        const row = signalRowOf(spec, request, new Date());
        if (row !== null) void this.write(row);
      }),
    );
  }

  private async write(row: SignalRow): Promise<void> {
    try {
      await this.database.db
        .insert(prospectSignals)
        .ignore()
        .values({ id: ulid(), ...row });
    } catch (error) {
      this.logger.logger.warn({ err: error, kind: row.kind }, 'sinyal prospek tidak tertulis');
    }
  }
}
