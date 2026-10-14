/** Jejak audit tindakan pengguna (audit keamanan 2026-10-14). */
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuditInterceptor, NO_ENTITY, auditEntryOf } from './audit.interceptor.js';
import { AUDITED, USER_AUDIT, type AuditSpec } from './audited.js';

const USER = '01JB0000000000000000000001';
const GUEST = '01JB0000000000000000000002';
const CONV = '01JB0000000000000000000003';

const req = (over: Record<string, unknown> = {}) =>
  ({ ip: '10.0.0.5', correlationId: 'c-1', params: {}, ...over }) as never;

describe('auditEntryOf — siapa, apa, terhadap apa; tanpa isi', () => {
  it('hapus percakapan oleh tamu: aktor tamu, entitas dari parameter rute', () => {
    expect(
      auditEntryOf(
        USER_AUDIT.conversationDelete,
        req({ guestSessionId: GUEST, params: { id: CONV } }),
        undefined,
        false,
      ),
    ).toEqual({
      actorId: GUEST,
      actorRole: 'guest',
      action: 'conversation.delete',
      entityType: 'conversation',
      entityId: CONV,
      ip: '10.0.0.5',
      correlationId: 'c-1',
    });
  });

  it('login berhasil: id pengguna dari respons menjadi aktor dan entitas', () => {
    const entry = auditEntryOf(
      USER_AUDIT.login,
      req({ guestSessionId: GUEST }),
      { userId: USER },
      false,
    );
    expect(entry).toMatchObject({
      actorId: USER,
      actorRole: 'user',
      entityId: USER,
      action: 'auth.login',
    });
  });

  it('login gagal tanpa sesi: anonim, entitas nol', () => {
    expect(auditEntryOf(USER_AUDIT.login, req(), null, true)).toMatchObject({
      actorId: NO_ENTITY,
      actorRole: 'anonymous',
      action: 'auth.login.failed',
      entityId: NO_ENTITY,
    });
  });
});

function interceptorWith(
  spec: AuditSpec | undefined,
  insert = vi.fn().mockResolvedValue(undefined),
) {
  const reflector = {
    get: (key: string) => (key === AUDITED ? spec : undefined),
  } as unknown as Reflector;
  const database = { db: { insert: () => ({ values: insert }) } } as never;
  const warn = vi.fn();
  const logger = { logger: { warn } } as never;
  const context = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({
      getRequest: () => req({ guestSessionId: GUEST, params: { id: CONV } }),
    }),
  } as never;
  return { interceptor: new AuditInterceptor(reflector, database, logger), context, insert, warn };
}

describe('AuditInterceptor', () => {
  it('endpoint ber-@Audited yang berhasil → satu baris audit', async () => {
    const { interceptor, context, insert } = interceptorWith(USER_AUDIT.conversationDelete);
    await lastValueFrom(interceptor.intercept(context, { handle: () => of(undefined) }));
    await Promise.resolve();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'conversation.delete', entityId: CONV, actorId: GUEST }),
    );
  });

  it('gagal dengan recordFailure → `.failed` dicatat, galat asli tetap dilempar', async () => {
    const { interceptor, context, insert } = interceptorWith(USER_AUDIT.login);
    const boom = new Error('kata sandi salah');
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => boom) })),
    ).rejects.toBe(boom);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login.failed' }));
  });

  it('tulis audit gagal → tindakan pengguna tetap berhasil, galat hanya di log', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('db mati'));
    const { interceptor, context, warn } = interceptorWith(USER_AUDIT.reportCreate, failing);
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of({ id: CONV }) })),
    ).resolves.toEqual({ id: CONV });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
  });

  it('endpoint tanpa @Audited tidak dicatat', async () => {
    const { interceptor, context, insert } = interceptorWith(undefined);
    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));
    expect(insert).not.toHaveBeenCalled();
  });
});
