/**
 * Mencatat endpoint ber-`@Audited` ke `audit_logs` setelah selesai. Pencatatan **tidak pernah**
 * menggagalkan tindakan pengguna: tulis yang gagal hanya dicatat di log (aplikasi lebih penting
 * daripada jejaknya, dan galat basis data sesaat tidak boleh membuat login gagal).
 */
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import { auditLogs } from '../../infrastructure/mysql/schema/ops.js';
import { DatabaseService } from '../database/database.service.js';
import type { PublicRequest } from '../http/actor.js';
import { LoggerService } from '../logging/logger.service.js';
import { ulid } from '../ulid.js';
import { AUDITED, type AuditSpec } from './audited.js';

/** `entity_id` wajib diisi: aksi tanpa entitas yang dikenal (login gagal) memakai nol. */
export const NO_ENTITY = '0'.repeat(26);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type AuditedRequest = PublicRequest & { readonly correlationId?: string };

export interface AuditEntry {
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly ip: string | null;
  readonly correlationId: string | null;
}

/** Siapa, terhadap apa — dari request dan (bila ada) respons yang sudah selesai. */
export function auditEntryOf(
  spec: AuditSpec,
  request: AuditedRequest,
  response: unknown,
  failed: boolean,
): AuditEntry {
  const body = (response ?? {}) as Record<string, unknown>;
  // Respons auth memakai `userId`; entitas lain `id`.
  const rawId = body['id'] ?? body['userId'];
  const fromBody = typeof rawId === 'string' && ULID.test(rawId) ? rawId : null;
  const param = request.params?.['id'];
  const fromParam = typeof param === 'string' && ULID.test(param) ? param : null;
  // Pengguna ber-token lebih dulu; login/daftar yang berhasil memberi id pengguna di respons.
  const userId = request.authUser?.userId ?? (spec.entityType === 'user' ? fromBody : null);
  const actorId = userId ?? request.guestSessionId ?? NO_ENTITY;
  const actorRole = userId !== null ? 'user' : request.guestSessionId ? 'guest' : 'anonymous';
  return {
    actorId,
    actorRole,
    action: failed ? `${spec.action}.failed` : spec.action,
    entityType: spec.entityType,
    entityId:
      fromParam ?? fromBody ?? (spec.entityType === 'user' ? (userId ?? NO_ENTITY) : NO_ENTITY),
    ip: request.ip ?? null,
    correlationId: request.correlationId ?? null,
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: DatabaseService,
    private readonly logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const spec = this.reflector.get<AuditSpec | undefined>(AUDITED, context.getHandler());
    if (spec === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    return next.handle().pipe(
      tap((response) => void this.write(auditEntryOf(spec, request, response, false))),
      catchError((error: unknown) => {
        if (spec.recordFailure) void this.write(auditEntryOf(spec, request, null, true));
        return throwError(() => error);
      }),
    );
  }

  private async write(entry: AuditEntry): Promise<void> {
    try {
      await this.database.db.insert(auditLogs).values({ id: ulid(), ...entry });
    } catch (error) {
      this.logger.logger.warn({ err: error, action: entry.action }, 'audit log tidak tertulis');
    }
  }
}
